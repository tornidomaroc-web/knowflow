/**
 * PER-SUBJECT PROGRESS FROM ROWS THE APP ALREADY WRITES (register #85, part 2
 * of docs/design/SIGNED_IN_FEATURES.md).
 *
 * A subject card that says "8 materials, 6 summarised, 3 quizzed, last used
 * yesterday" instead of a name and a date. Pure: three row lists in, one
 * record per subject out, so the subjects page, the home and the proof all
 * compute the same numbers from the same rule.
 *
 * "Summarised" means `summary_generated_at` is set (the home's measure, ruled
 * for #85). "Quizzed" means at least one quiz exists for the material in ANY
 * language: a quiz is per (document, lang) (#28/#31), and a card counts
 * materials, not languages. Materials in `error` are counted as materials
 * and never as progress.
 */
export interface DocumentRow {
  id: string;
  kb_id: string;
  status: string;
  summary_generated_at: string | null;
  created_at?: string | null;
}

export interface QuizRow {
  document_id: string;
}

export interface ConversationRow {
  kb_id: string;
  created_at: string;
}

export interface SubjectStats {
  materials: number;
  ready: number;
  processing: number;
  failed: number;
  summarised: number;
  quizzed: number;
  /** The newest conversation, else the newest material, else null. ISO string. */
  lastActivityAt: string | null;
  /** Whether the newest activity is a conversation (true) or a material (false). */
  lastActivityIsAsk: boolean;
}

export function emptyStats(): SubjectStats {
  return { materials: 0, ready: 0, processing: 0, failed: 0, summarised: 0, quizzed: 0, lastActivityAt: null, lastActivityIsAsk: false };
}

export function subjectStats(
  documents: DocumentRow[],
  quizzes: QuizRow[],
  conversations: ConversationRow[]
): Map<string, SubjectStats> {
  const out = new Map<string, SubjectStats>();
  const get = (kb: string) => {
    let s = out.get(kb);
    if (!s) { s = emptyStats(); out.set(kb, s); }
    return s;
  };
  const quizzedDocs = new Set(quizzes.map((q) => q.document_id));
  for (const d of documents) {
    const s = get(d.kb_id);
    s.materials += 1;
    if (d.status === 'ready') s.ready += 1;
    else if (d.status === 'error') s.failed += 1;
    else s.processing += 1;
    if (d.status !== 'error' && d.summary_generated_at) s.summarised += 1;
    if (d.status !== 'error' && quizzedDocs.has(d.id)) s.quizzed += 1;
    if (d.created_at && (!s.lastActivityAt || d.created_at > s.lastActivityAt)) {
      s.lastActivityAt = d.created_at;
      s.lastActivityIsAsk = false;
    }
  }
  for (const c of conversations) {
    const s = get(c.kb_id);
    if (!s.lastActivityAt || c.created_at > s.lastActivityAt) {
      s.lastActivityAt = c.created_at;
      s.lastActivityIsAsk = true;
    }
  }
  return out;
}

/** 0..100, summarised over materials; 0 when there is nothing to summarise. */
export function summarisedPercent(s: SubjectStats): number {
  if (s.materials === 0) return 0;
  return Math.round((s.summarised / s.materials) * 100);
}
