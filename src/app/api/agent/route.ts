import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkConversationLimit, conversationMonthWindow } from '@/lib/limits-server';
import { enforceLimit } from '@/lib/rate-limit';
import { resolveLocale, type Locale } from '@/lib/i18n';
import { monthlyConversationMessage } from '@/lib/limit-messages';
import { embedQuery } from '@/lib/ingestion';
import { recordStudyEvent } from '@/lib/study-events';
import {
  USD_PER_INPUT_TOKEN,
  USD_PER_OUTPUT_TOKEN,
  USD_PER_CACHE_READ_TOKEN,
  USD_PER_CACHE_WRITE_TOKEN,
} from '@/lib/usage-cost';

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

// The answering model, named once. The rates that price its usage log line moved
// to `@/lib/usage-cost` (#110's PR) so this route, `/api/summarize` and
// `/api/quiz/generate` cannot price the same token differently; the values are
// unchanged. They annotate the log only and never gate behaviour.
const ANSWER_MODEL = 'claude-haiku-4-5-20251001';

/**
 * LEVER 1 - the answer cap, cut 2048 -> 600.
 *
 * Output is priced at 5x input ($5 vs $1 per MTok), so the answer cap is the tail
 * of the cost distribution, not the body of it. Measured against the source
 * before this change: a question whose answer ran to the old 2048 cap cost
 * $0.01449, against $0.00575 for the same question with a ~300-token answer -
 * the cap alone was 2.5x the whole cost of a normal question. SYSTEM_INSTRUCTIONS
 * already ends with "Be concise. Prefer short, direct answers over long ones", so
 * this makes the prompt's own instruction enforceable rather than advisory.
 *
 * 600 IS AN ASSUMPTION AND THIS PR EXISTS TO TEST IT. Every truncation is logged
 * with `truncated: true` below. If the truncation rate is material - and it will
 * be higher in Arabic, which tokenizes to roughly twice as many tokens per
 * character as English - then 600 was the wrong number and the log will say so.
 * Tune it on that evidence, not on this comment.
 */
const MAX_ANSWER_TOKENS = 600;

/**
 * LEVER 2 - a token budget on replayed history.
 *
 * `.limit(10)` bounds the number of messages and says nothing about their size.
 * Ten messages at the old 2048 cap carry 10,440 input tokens - more than twice
 * the 4,096-token retrieved context, and the single largest term in the worst
 * case ($0.02493/question, of which history was $0.01044).
 *
 * WHY THE ESTIMATOR IS SCRIPT-AWARE. There is no tokenizer in the Next runtime,
 * so this counts characters and converts. A single ratio would be wrong for this
 * product: Arabic runs to roughly 2 characters per token where English runs to
 * about 4.4, so a chars/4 rule would under-count Arabic by more than half and
 * quietly blow the budget for the audience the budget exists to protect. Arabic
 * codepoints are therefore charged at 2 chars/token and everything else at 4 -
 * deliberately conservative in both directions, since over-counting only trims
 * history further and costs nothing but context.
 *
 * The true figure is unknowable from here; `input_tokens` in the usage log is the
 * measurement that will correct this estimator.
 */
const HISTORY_TOKEN_BUDGET = 1200;

function estimateTokens(text: string): number {
  let arabic = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    // Arabic + Arabic Supplement + Extended-A cover what this product actually sees.
    if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f) || (c >= 0x08a0 && c <= 0x08ff)) arabic++;
  }
  return Math.ceil(arabic / 2 + (text.length - arabic) / 4);
}

export async function POST(request: Request) {
  try {
    const { message, kb_id, conversation_id, locale } = await request.json();
    // Whitelisted server-side, exactly as /api/summarize does (register #27):
    // the value is never interpolated, only used to pick a locale key.
    const safeLocale: Locale = resolveLocale(locale);
    if (!message || !kb_id) {
      return NextResponse.json({ error: 'Missing message or kb_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // B7 cost guard: burst + daily query cap, in front of the expensive
    // embed/retrieve/Claude work. Returned as text/plain (not JSON) so the
    // streaming client renders the message cleanly while the status is a real 429.
    const limit = await enforceLimit(user.id, 'query', safeLocale);
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
      const message = monthlyConversationMessage(
        safeLocale,
        convoLimit.limit,
        convoLimit.tier,
        conversationMonthWindow().nextStart
      );
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
        // pgvector's `vector` argument is generated as `string`, but the RPC
        // accepts a JSON number[] on the wire and postgREST coerces it to a
        // vector — which is how this has always run. Type-only assertion; the
        // value passed is unchanged (still the number[] from embedQuery), so
        // there is no runtime behaviour change.
        query_embedding: queryEmbedding as unknown as string,
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
      // RETRIEVAL INFRASTRUCTURE FAILURE — this is NOT "the knowledge base had
      // no matching chunks". Control only reaches here when embedQuery threw:
      // the ingestion service was unreachable, returned a non-2xx (a
      // desynchronized INGESTION_TOKEN reads exactly like this), or
      // INGESTION_SERVICE_URL was unset. A genuine no-match returns normally
      // with an empty `data` and never enters this catch.
      //
      // We still fall through with zero chunks, so the user sees the ordinary
      // "I can't find that in your materials" answer — indistinguishable from an
      // empty knowledge base. THAT AMBIGUITY IS THE BUG: it is why a nine-day
      // ingestion outage produced no Ask complaints (register #54). Changing
      // what the user sees is deliberately NOT in this PR; what changes here is
      // that the log line names the cause and carries a tag that can be alerted
      // on without matching prose.
      console.error(
        `[retrieval-infra-failure] embedQuery threw for kb_id=${kb_id}; answering with zero chunks:`,
        e
      );
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
    // Recorded for the usage log so the budget's effect is measurable, not assumed.
    let historyDropped = 0;
    let historyTokensEst = 0;

    if (convoId) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (msgs) {
        // LEVER 2. `msgs` arrives NEWEST-FIRST, which is what makes the walk
        // correct: spend the budget on the most recent turns and drop the oldest,
        // because recency is what a follow-up question depends on.
        //
        // The budget is respected STRICTLY - if even the newest message exceeds
        // it, history is empty. That is deliberate: the alternative is truncating
        // a stored message mid-sentence and replaying a mutilated turn as if the
        // student had said it. The case is also self-liquidating, because with
        // MAX_ANSWER_TOKENS at 600 no answer written from now on can approach
        // HISTORY_TOKEN_BUDGET; only answers stored under the old 2048 cap can.
        const kept: typeof msgs = [];
        let remaining = HISTORY_TOKEN_BUDGET;
        for (const m of msgs) {
          const cost = estimateTokens(m.content);
          if (cost > remaining) break;
          remaining -= cost;
          kept.push(m);
        }
        historyDropped = msgs.length - kept.length;
        historyTokensEst = HISTORY_TOKEN_BUDGET - remaining;
        history = kept
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
    //
    // THE `cache_control` MARKER THAT USED TO SIT ON SYSTEM_INSTRUCTIONS IS GONE,
    // AND IT IS NOT COMING BACK ON THIS MODEL. It read
    // `cache_control: { type: 'ephemeral' }` and cached NOTHING: Haiku 4.5's
    // minimum cacheable prefix is 4,096 tokens and SYSTEM_INSTRUCTIONS is 482
    // characters, roughly 110 tokens. Below the minimum the API does not error -
    // it returns `cache_creation_input_tokens: 0` and moves on, so the marker
    // bought nothing while reading as though caching were handled.
    //
    // It cannot be "made real" here either, and the reason is worth writing down
    // so nobody re-adds it. Caching needs a STABLE prefix over the minimum. The
    // retrieved context changes on every query by construction. The only
    // growing-stable prefix is the history - and LEVER 2 above caps that at 1,200
    // tokens, so after this change history can never reach 4,096. The two are in
    // direct tension and the budget wins by a wide margin: it is worth 37% of the
    // worst-case question, where caching 1,200 tokens of history would save about
    // a tenth of a cent. Padding the system prompt to 4,096 tokens to qualify
    // would mean paying a 1.25x cache WRITE to store filler.
    const userTurn = `Retrieved passages:\n\n${contextBlock}\n\n---\n\nQuestion: ${message}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    const stream = await anthropic.messages.create({
      model: ANSWER_MODEL,
      max_tokens: MAX_ANSWER_TOKENS,
      system: SYSTEM_INSTRUCTIONS,
      messages: [...history, { role: 'user', content: userTurn }],
      stream: true,
    });

    const encoder = new TextEncoder();
    const citationsHeader = Buffer.from(JSON.stringify(citations)).toString('base64');

    const readable = new ReadableStream({
      async start(controller) {
        let assistantMessage = '';
        // THE MEASUREMENT. Until this line existed the app read `response.usage`
        // nowhere, so every cost figure this project has ever quoted - including
        // the ones the price was set on - was derived from source constants and
        // an assumed answer length. `message_start` carries the input side,
        // `message_delta` carries the cumulative output and the stop reason.
        let inputTokens = 0;
        let outputTokens = 0;
        let cacheReadTokens = 0;
        let cacheWriteTokens = 0;
        let stopReason: string | null = null;
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'message_start') {
              const u = chunk.message.usage;
              inputTokens = u.input_tokens ?? 0;
              cacheReadTokens = u.cache_read_input_tokens ?? 0;
              cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
            } else if (chunk.type === 'message_delta') {
              outputTokens = chunk.usage.output_tokens ?? outputTokens;
              stopReason = chunk.delta.stop_reason ?? stopReason;
            } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              assistantMessage += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // P5.2 study event. This route's success point is NOT the `return new
          // Response(...)` below it: that hands back a ReadableStream with a 200 the
          // instant the stream OPENS, before Claude has emitted a single token. An
          // emit there would fire for a question that then died mid-stream — and,
          // worse, the conversation-limit branch ALSO returns a 200 text stream
          // (carrying only "You've reached your monthly limit"), so a status-based
          // gate would credit a study event to a student who was refused an answer.
          // That branch returns early and never reaches this closure, which is
          // exactly why the emit belongs here.
          //
          // So the real success point is here: the for-await drained without
          // throwing, meaning the model produced a complete answer that the student
          // has now received. The non-empty check rejects a stream that opened and
          // closed with no text — a question with no answer is not studying. A
          // mid-stream failure jumps to the catch below and emits nothing.
          //
          // Placed BEFORE the assistant-message insert on purpose: both are
          // bookkeeping, and the student's answer does not become un-studied because
          // a `messages` row failed to persist. Fails open; never throws.
          if (assistantMessage.trim()) {
            await recordStudyEvent(supabase, 'question_asked');
          }

          await supabase.from('messages').insert({
            conversation_id: convoId,
            role: 'assistant',
            content: assistantMessage,
          });

          // ONE STRUCTURED LINE PER ANSWERED QUESTION. JSON so it can be parsed
          // out of the log sink without matching prose, and tagged so it can be
          // filtered without matching the route name.
          //
          // NO QUESTION TEXT AND NO ANSWER TEXT IS LOGGED - only counts. The
          // user id IS logged, because the decision this data exists to inform is
          // the Pro daily cap, and a per-question distribution cannot answer
          // "what does the heaviest user cost" without it. Vercel is already a
          // disclosed sub-processor on the privacy page ("hosts the website and
          // handles every request made to it"), so this adds no recipient.
          //
          // RETENTION IS THE OPEN RISK, NOT THE CODE: how long these lines
          // survive depends on the log retention of the Vercel plan in use, which
          // was not readable this session. If a week of history does not survive,
          // this line is correct and still useless, and the durable table
          // (register #94) is the fix rather than a different log line.
          const usd =
            inputTokens * USD_PER_INPUT_TOKEN +
            outputTokens * USD_PER_OUTPUT_TOKEN +
            cacheReadTokens * USD_PER_CACHE_READ_TOKEN +
            cacheWriteTokens * USD_PER_CACHE_WRITE_TOKEN;
          console.log(
            JSON.stringify({
              tag: 'kf-usage',
              route: 'agent',
              model: ANSWER_MODEL,
              user_id: user.id,
              conversation_id: convoId,
              locale: safeLocale,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cache_read_tokens: cacheReadTokens,
              cache_write_tokens: cacheWriteTokens,
              stop_reason: stopReason,
              // The single number that says whether MAX_ANSWER_TOKENS is too low.
              truncated: stopReason === 'max_tokens',
              context_chunks: chunks.length,
              history_msgs: history.length,
              history_dropped: historyDropped,
              history_tokens_est: historyTokensEst,
              answer_chars: assistantMessage.length,
              usd: Number(usd.toFixed(6)),
            })
          );
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
