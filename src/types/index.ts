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
