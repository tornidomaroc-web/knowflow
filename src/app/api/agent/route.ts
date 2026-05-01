import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkConversationLimit } from '@/lib/limits-server';

export async function POST(request: Request) {
  try {
    const { message, kb_id, conversation_id } = await request.json();
    if (!message || !kb_id) return NextResponse.json({ error: 'Missing message or kb_id' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const canChat = await checkConversationLimit(user.id);
    if (!canChat) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("You've reached your monthly conversation limit. Upgrade to Pro to continue."));
          controller.close();
        }
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/plain' } });
    }

    const { data: docs } = await supabase
      .from('documents')
      .select('markdown_content, filename')
      .eq('kb_id', kb_id)
      .eq('status', 'ready');

    let context = docs?.map(d => `--- ${d.filename} ---\n${d.markdown_content}`).join('\n\n') || '';
    if (context.length > 80000) context = context.substring(0, 80000);

    let convoId = conversation_id;
    let history: { role: string; content: string }[] = [];

    if (convoId) {
      const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', convoId).order('created_at', { ascending: false }).limit(10);
      if (msgs) history = msgs.reverse().map(m => ({ role: m.role, content: m.content }));
    } else {
      const { data: newConvo } = await supabase.from('conversations').insert({ kb_id, user_id: user.id, platform: 'web' }).select().single();
      if (newConvo) convoId = newConvo.id;
    }

    if (!convoId) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    await supabase.from('messages').insert({ conversation_id: convoId, role: 'user', content: message });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    const systemPrompt = `You are KnowFlow, an intelligent assistant that answers questions based strictly on the provided knowledge base content. Answer in the same language the user uses (Arabic or English). If the answer is not in the knowledge base, say so clearly. Be concise and accurate.
    
KNOWLEDGE BASE CONTENT:
${context}`;

    const stream = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: message }] as any,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let assistantMessage = '';
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              assistantMessage += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          await supabase.from('messages').insert({ conversation_id: convoId, role: 'assistant', content: assistantMessage });
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain', 'X-Conversation-Id': convoId }
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
