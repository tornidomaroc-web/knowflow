# The AI allowance refusal (DRAFT, NOT APPROVED, WIRED FOR REVIEW)

**Status: DRAFT for the owner, 2026-11-15.** The sentence is wired into
`src/lib/i18n/locales/en.ts` and `ar.ts` as `dashboard.aiAllowance.used`,
because the allowance cannot ship without one. It stays a draft until the
owner approves it at review; an approved change is one edit here and one in
each dictionary, and `scripts/verify-ai-allowance.mjs` holds all three to the
same text.

## When it is shown

When an account's AI spend in the last 30 days (rolling) has reached its
ceiling (`AI_ALLOWANCE_USD`, `src/lib/ai-allowance.ts`), every call that would
reach Anthropic or Voyage AI is refused before it is sent: a question
(`/api/agent`, text/plain, status 429, header `X-KF-Refusal:
ai-allowance-used`), a summary and a quiz (`/api/summarize`,
`/api/quiz/generate`, JSON `{ error, code: "ai-allowance-used" }`, status
429) and an upload (`/api/ingest`, the same JSON). Nothing is sent, nothing is
counted against the day, and nothing is recorded. Already made summaries and
quizzes, and every material already uploaded, stay readable.

The sentence names no amount, no price, no plan and no date: the window
rolls, so the allowance comes back gradually as earlier use passes 30 days,
and the sentence says exactly that.

| | Text |
|---|---|
| en | You have reached the AI use available to your account in the last 30 days. Nothing was sent. Uploading, asking, summaries and quizzes come back gradually as your earlier use passes 30 days. |
| ar | وصلت إلى حد استخدام الذكاء الاصطناعي المتاح لحسابك خلال آخر 30 يومًا. لم يُرسَل شيء. يعود الرفع والأسئلة والملخصات والاختبارات تدريجيًا كلما مضى 30 يومًا على استخدامك السابق. |

Arabic notes: Modern Standard Arabic; يومًا with tanween fatha, as `ar.ts`
writes it; Western digits; no gendered address beyond the second person the
app already uses (وصلت, حسابك). الرفع والأسئلة والملخصات والاختبارات follows
the order of the English sentence and the nouns the consent sheet uses.

## Rules held by the proof

No em or en dash; no price, plan, upgrade or "free" wording in either
language (the app must never show those); Western digits only; no Latin
letter inside the Arabic.
