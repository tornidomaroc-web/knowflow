export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  plan: 'free' | 'pro';
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  language: 'ar' | 'en' | 'both';
  created_at: string;
}

export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_type: 'pdf' | 'docx' | 'xlsx' | 'mp3' | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  markdown_content: string | null;
  chunk_count: number;
  created_at: string;
  // Phase 3 (per-document summaries) — generated on demand from markdown_content
  // and stored (generate-once). `summary` null = not generated yet.
  // `summary_is_partial` is true only when the source exceeded the model input cap
  // and the summary honestly covers just the first part (never a silent truncation).
  summary: string | null;
  summary_generated_at: string | null;
  summary_model: string | null;
  summary_is_partial: boolean;
}

/**
 * Phase 4 (P4.0) — document-scoped, server-graded multiple-choice quizzes.
 * One quiz is generated once per document (generate-once, read-many, like the
 * Phase 3 summary). `generated_at`/`model` are null until a generation run
 * (P4.1) fills them.
 */
export interface Quiz {
  id: string;
  document_id: string;
  generated_at: string | null;
  model: string | null;
  created_at: string;
  // Phase 4 (P4.1 follow-up) — true when the quiz was generated from only the
  // first INPUT_CHAR_CAP chars of a long document (never a silent truncation).
  // Persisted so a cached read reports it truthfully. Column added by
  // 20260708_quizzes_is_partial.sql.
  is_partial: boolean;
}

/**
 * A quiz question as stored on the SERVER. `correct_index` is the 0-based index
 * into `options` of the correct choice.
 *
 * SECURITY: `correct_index` is server-only. It must NEVER be sent to the client
 * — grading happens server-side (P4.2). Use `ClientQuizItem` for anything that
 * crosses the wire; it structurally omits `correct_index` so a leak is a type
 * error, not just a convention.
 */
export interface QuizItem {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
  position: number;
}

/**
 * The ONLY quiz-item shape allowed in a client payload: everything except the
 * answer. Deriving it with `Omit` keeps it locked to `QuizItem` — adding a field
 * to the server type without deciding its client exposure fails loudly here.
 */
export type ClientQuizItem = Omit<QuizItem, 'correct_index'>;

/**
 * Phase 5 (P5.1) — the four study actions that count toward a streak. Decided
 * 2026-07-09 and mirrored by the `study_event_kind_valid` CHECK and by
 * `record_study_event`'s fail-closed guard, both in `20260709_study_events.sql`.
 *
 * `'summary_read'` is deliberately NOT a member: passively viewing stored text is
 * not studying, and admitting it would make the streak farmable by opening a page.
 * An empty quiz submission (zero in-range answers) emits NO event at all.
 */
export type StudyEventKind =
  | 'quiz_submitted'
  | 'summary_generated'
  | 'question_asked'
  | 'material_uploaded';

/**
 * Phase 5 (P5.1) — one recorded study action. The streak substrate.
 *
 * `occurred_at` is the INSTANT, never a server-bucketed day: the streak groups
 * events into days in the STUDENT'S timezone at read time. A `day date` column
 * computed with `current_date` (server UTC) would record a UTC+1 student's 00:30
 * session on the previous day, and destroying the instant makes that permanent.
 *
 * There is deliberately NO `document_id`/`quiz_id`/`kb_id` here. A streak is an
 * immutable claim about what the student did; deleting a subject must never
 * rewrite it. The only FK is to the user (register #33, register #34).
 *
 * Written only via the `record_study_event` RPC — `study_events` has a read-own
 * RLS policy and no insert/update/delete policy, so it is append-only from
 * outside and cannot be backdated.
 */
export interface StudyEvent {
  id: string;
  user_id: string;
  kind: StudyEventKind;
  occurred_at: string;
}

export interface Conversation {
  id: string;
  kb_id: string;
  user_id: string;
  platform: 'web' | 'telegram' | 'slack';
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * Billing tier derived from the `subscriptions` table — the single source of
 * truth for entitlement (see docs/PIVOT_PLAN.md §3). Distinct from
 * `Profile.plan`, which is being retired as an entitlement signal (B2).
 */
export type Tier = 'free' | 'pro';

/**
 * The entitlement contract read by both the web app and the mobile app
 * (via GET /api/entitlement). Mobile keys ad display off `adsEnabled`; it never
 * computes entitlement locally.
 */
export interface Entitlement {
  tier: Tier;
  adsEnabled: boolean;
  /** ISO timestamp the current Pro period ends, or null when free. */
  expiresAt: string | null;
}
