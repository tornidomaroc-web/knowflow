import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkConversationLimit } from '@/lib/limits-server';
import { enforceLimit } from '@/lib/rate-limit';
import { embedQuery } from '@/lib/ingestion';

interface MatchedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
  similarity: number;
}

interface Citation {
  index: number;
  document_id: string;
  chunk_id: string;
  filename: string;
  similarity: number;
}

const SYSTEM_INSTRUCTIONS = `You are KnowFlow, an intelligent assistant that answers questions strictly from the retrieved knowledge-base passages provided in the user message.

Rules:
- Always answer in the same language the user used (Arabic or English).
- Cite the passages you use with bracketed numbers like [1], [2] that match the numbered passages in the context.
- If the answer is not present in the passages, say so clearly. Do not fabricate.
- Be concise. Prefer short, direct answers over long ones.`;

const MATCH_COUNT = 8;

export async function POST(request: Request) {
  try {
    const { message, kb_id, conversation_id } = await request.json();
    if (!message || !kb_id) {
      return NextResponse.json({ error: 'Missing message or kb_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // B7 cost guard: burst + daily query cap, in front of the expensive
    // embed/retrieve/Claude work. Returned as text/plain (not JSON) so the
    // streaming client renders the message cleanly while the status is a real 429.
    const limit = await enforceLimit(user.id, 'query');
    if (!limit.allowed) {
      return new Response(limit.error, {
        status: limit.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const convoLimit = await checkConversationLimit(user.id);
    if (!convoLimit.allowed) {
      // Tier-correct: real per-tier monthly limit; only free users get the
      // upgrade prompt (a Pro user is already on the top tier).
      const tail = convoLimit.tier === 'pro' ? '' : ' Upgrade to Pro for a higher limit.';
      const message = `You've reached your monthly limit of ${convoLimit.limit} conversations.${tail}`;
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(message));
          controller.close();
        },
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/plain' } });
    }

    // 1. Embed the query and retrieve relevant chunks (RLS still applies because
    //    the RPC is SECURITY INVOKER).
    let chunks: MatchedChunk[] = [];
    try {
      const queryEmbedding = await embedQuery(message);
      const { data, error } = await supabase.rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_kb_id: kb_id,
        match_count: MATCH_COUNT,
        match_threshold: 0.3,
      });
      if (error) {
        console.error('match_chunks error:', error.message);
      } else {
        chunks = (data ?? []) as MatchedChunk[];
      }
    } catch (e) {
      console.error('Embedding/retrieval failed:', e);
      // Fall through with empty chunks; the model will say it can't find an answer.
    }

    const citations: Citation[] = chunks.map((c, i) => ({
      index: i + 1,
      document_id: c.document_id,
      chunk_id: c.id,
      filename: c.filename,
      similarity: c.similarity,
    }));

    const contextBlock = chunks.length
      ? chunks
          .map((c, i) => `[${i + 1}] (${c.filename})\n${c.content}`)
          .join('\n\n---\n\n')
      : '(no relevant passages found)';

    // 2. Conversation bookkeeping.
    let convoId = conversation_id;
    let history: { role: 'user' | 'assistant'; content: string }[] = [];

    if (convoId) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (msgs) {
        history = msgs
          .reverse()
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      }
    } else {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({ kb_id, user_id: user.id, platform: 'web' })
        .select()
        .single();
      if (newConvo) convoId = newConvo.id;
    }

    if (!convoId) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });

    await supabase.from('messages').insert({ conversation_id: convoId, role: 'user', content: message });

    // 3. Compose the user turn so retrieved context is fresh per query.
    //    Prompt caching applies to the static system instructions only.
    const userTurn = `Retrieved passages:\n\n${contextBlock}\n\n---\n\nQuestion: ${message}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    const stream = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_INSTRUCTIONS,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [...history, { role: 'user', content: userTurn }],
      stream: true,
    });

    const encoder = new TextEncoder();
    const citationsHeader = Buffer.from(JSON.stringify(citations)).toString('base64');

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
          await supabase.from('messages').insert({
            conversation_id: convoId,
            role: 'assistant',
            content: assistantMessage,
          });
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Conversation-Id': convoId,
        'X-Citations': citationsHeader,
      },
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
