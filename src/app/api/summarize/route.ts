import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { enforceLimit } from '@/lib/rate-limit';
import { recordStudyEvent } from '@/lib/study-events';

// Same cheap tier as /api/agent — a summary is a single, bounded Haiku call.
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

// Input cap: ~48K tokens ≈ ~120K chars, chosen cross-language-safe (Arabic is
// less token-dense per char than English, so chars is the conservative bound). A
// document longer than this is summarized from its first INPUT_CHAR_CAP chars and
// the result is honestly flagged partial — NEVER a silent truncation.
const INPUT_CHAR_CAP = 120_000;

// Thin-content guard (fabrication safeguard, code layer): below this many
// non-whitespace chars there isn't enough real source to summarize. We refuse in
// code rather than pay for — and risk a padded/fabricated — model call. A model
// asked to "summarize almost nothing" is exactly where invention happens.
const MIN_CONTENT_CHARS = 200;

const MAX_SUMMARY_TOKENS = 1024;

// Belt-and-suspenders plain-text safety net. The summary is rendered as literal
// text (whitespace-pre-wrap, no Markdown renderer) and is permanent once stored
// (generate-once, no regenerate; register #26), so a single stray marker would
// stick forever. We therefore strip only UNAMBIGUOUS Markdown before persisting
// and deliberately leave real content untouched:
//   - **bold**/__bold__ -> inner text (paired markers only; a lone `*` is kept,
//     and `__` is word-boundary guarded so snake_case like my__var__x survives)
//   - a leading "# ".."###### " heading marker at the start of a line -> removed
//     (requires whitespace after the hashes, so "C#" and "#1" are NOT touched)
function stripStrayMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\w)__(.+?)__(?!\w)/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .trim();
}

// Fabrication safeguard (prompt layer): a strict, source-tying instruction. The
// user turn wraps the source in a <document> block and this system prompt binds
// the model to it, prefers brevity over padding, and gives an explicit
// thin-content escape so the honest move is never to invent.
const SYSTEM_INSTRUCTIONS = `You are KnowFlow's study-summary writer. You write a faithful summary of ONE study document for a student.

Rules:
- Summarize ONLY what is inside the <document> block in the user message. It is your sole source of truth.
- Never add facts, examples, numbers, or conclusions that are not in the document. If it is not in the document, it does not go in the summary.
- Write your summary in the language specified in the user message below, regardless of the document's own language.
- Output PLAIN TEXT only. Do NOT use any Markdown formatting: no ** for bold, no * for italics, no # headings, no backticks, and no bullet characters. Write in plain sentences and paragraphs.
- Prefer brevity. Cover the document's actual key points and then stop — do NOT pad to a target length. A short document gets a short summary.
- If the document is too thin or has no real content to summarize, say that plainly in one sentence instead of inventing material.
- Output the summary text only — no preamble such as "Here is a summary".`;

export async function POST(request: Request) {
  try {
    const { document_id, locale } = await request.json();
    if (!document_id || typeof document_id !== 'string') {
      return NextResponse.json({ error: 'Missing document_id' }, { status: 400 });
    }
    // Fail-closed whitelist: the summary follows the APP UI language, never the
    // document's language. Any value other than 'ar' collapses to 'en' so a raw
    // client string can never reach the prompt. (Only the concrete directive
    // built from `lang` is interpolated, never `locale` itself.)
    const lang = locale === 'ar' ? 'ar' : 'en';

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ownership is enforced by RLS: this select returns the row only if the
    // document belongs to a knowledge base the caller owns (the "manage own
    // documents" policy). A missing OR not-owned row both come back null → 404,
    // which is also the right behavior (never leak that a doc exists).
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select(
        'id, status, markdown_content, summary, summary_generated_at, summary_model, summary_is_partial'
      )
      .eq('id', document_id)
      .maybeSingle();

    if (docErr) {
      console.error('summarize: document fetch failed', docErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Generate-once, read-many — the primary cost control. If a summary already
    // exists, return it WITHOUT another Claude call or counter increment.
    if (doc.summary) {
      return NextResponse.json({
        summary: doc.summary,
        is_partial: doc.summary_is_partial ?? false,
        generated_at: doc.summary_generated_at,
        model: doc.summary_model,
        cached: true,
      });
    }

    // Only a fully-processed document has usable text.
    if (doc.status !== 'ready') {
      return NextResponse.json(
        { error: 'This material is still processing. Try again once it is ready.' },
        { status: 409 }
      );
    }

    // Code-layer fabrication guard: never call the model on empty/near-empty
    // content. Runs BEFORE enforceLimit so a no-op request doesn't burn a counter.
    const content = (doc.markdown_content ?? '').trim();
    if (content.replace(/\s/g, '').length < MIN_CONTENT_CHARS) {
      return NextResponse.json(
        { error: 'There is not enough text in this material to summarize.' },
        { status: 422 }
      );
    }

    // B7 cost guard: dedicated daily summary cap, placed IN FRONT of the paid
    // Claude call so a denial short-circuits before any cost. The 'summary' kind
    // is its own counter, so a whole-document summary never drains the query cap.
    // (Matches /api/agent and /api/ingest: the atomic increment happens before the
    // paid work, so a rare model failure after this point still counts — the
    // fail-closed cost ceiling is preferred pre-revenue over a decrement race.)
    const limit = await enforceLimit(user.id, 'summary');
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    // Long-document handling: single pass within the input cap. If the source is
    // larger we summarize its first INPUT_CHAR_CAP chars and mark the result
    // partial — an explicit, surfaced label (see summary_is_partial), never a
    // silent cut. The model is also told it is seeing only the first part.
    const isPartial = content.length > INPUT_CHAR_CAP;
    const sourceText = isPartial ? content.slice(0, INPUT_CHAR_CAP) : content;
    const partialNote = isPartial
      ? '\n\nNote: this is only the FIRST PART of a longer document. Summarize just the part provided below; do not guess at the rest.'
      : '';

    // Concrete language directive (dynamic, per request) so the cached system
    // block stays constant and does not fork per locale. Placed BEFORE the
    // <document> block as a standalone instruction sentence, so the model never
    // mistakes it for content to summarize. It also explicitly covers the
    // cross-language case (e.g. Arabic UI over an English document).
    const langDirective =
      lang === 'ar'
        ? 'Write the summary in Arabic (العربية), even if the document itself is written in another language such as English. Translate the meaning faithfully into Arabic; do not leave sentences in the source language.'
        : 'Write the summary in English, even if the document itself is written in another language such as Arabic. Translate the meaning faithfully into English; do not leave sentences in the source language.';

    const userTurn = `${langDirective}\n\nSummarize the following study document.${partialNote}\n\n<document>\n${sourceText}\n</document>`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    let summaryText = '';
    try {
      const resp = await anthropic.messages.create({
        model: SUMMARY_MODEL,
        max_tokens: MAX_SUMMARY_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_INSTRUCTIONS,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userTurn }],
      });
      summaryText = resp.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
    } catch (e) {
      console.error('summarize: Claude call failed', e);
      return NextResponse.json(
        { error: 'Could not generate a summary right now. Please try again shortly.' },
        { status: 502 }
      );
    }

    // Runs once, on the value that gets stored (permanent). If stripping leaves
    // nothing, the empty-response guard below fires the same 502 as an empty
    // model reply, which is the correct fail-safe (never persist a blank).
    summaryText = stripStrayMarkdown(summaryText);

    if (!summaryText) {
      // Empty model output — do not persist an empty summary (that would poison
      // the generate-once cache with a blank).
      return NextResponse.json(
        { error: 'Could not generate a summary right now. Please try again shortly.' },
        { status: 502 }
      );
    }

    const generatedAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('documents')
      .update({
        summary: summaryText,
        summary_generated_at: generatedAt,
        summary_model: SUMMARY_MODEL,
        summary_is_partial: isPartial,
      })
      .eq('id', document_id);

    if (updErr) {
      console.error('summarize: persist failed', updErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // P5.2 study event. This is the LAST statement before the success response, and
    // every failure mode is already behind us: the 400, the 401, the 404, the
    // still-processing 409, the thin-content 422, the rate-limit denial, the two
    // 502s (Claude threw / returned empty), and the persist 500. A summary that
    // 502s did not generate a summary and must not feed a streak.
    //
    // NOT on the cached branch above (`if (doc.summary)`, which returns
    // `cached: true` without a Claude call). Re-reading a summary you generated last
    // week is `summary_read`, and that kind was deliberately excluded from the union
    // — admitting it would make the streak farmable by opening a page. This emit
    // fires once, on the request that actually generated the text.
    //
    // Fails open: a lost event never costs the student their summary.
    await recordStudyEvent(supabase, 'summary_generated');

    return NextResponse.json({
      summary: summaryText,
      is_partial: isPartial,
      generated_at: generatedAt,
      model: SUMMARY_MODEL,
      cached: false,
    });
  } catch (error) {
    console.error('Summarize API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
