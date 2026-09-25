/**
 * SUGGESTED FIRST QUESTIONS FOR THE ASK SCREEN (register #85, 2.3; corrected
 * for register #121, defect 4).
 *
 * The first version built them from FILE NAMES, and a file named
 * `xilvaroth-n11-20260810.pdf` produced a question about "xilvaroth-n11-
 * 20260810", with the Latin token breaking the Arabic sentence's direction.
 * A file name is not a topic. The topic now comes, in order, from:
 *   1. the material's SUMMARY, when one exists: its first sentence, which
 *      the model wrote about the content;
 *   2. the file name, only when it reads like a title a person typed (has
 *      spaces or Arabic letters, is not a code of letters and digits);
 *   3. nothing — the subject alone, which every subject has.
 *
 * Every topic is wrapped in Unicode isolates (FSI … PDI, U+2068/U+2069) so a
 * Latin title inside an Arabic question, or the reverse, keeps the sentence's
 * direction and its punctuation in place. The isolates are invisible, are
 * kept when the question is sent (a model ignores them), and are what the
 * proof checks for.
 *
 * NOTHING IS SENT until a suggestion is pressed; a pressed one is the
 * student's own message through the unchanged `/api/agent` path.
 */
export interface SuggestionTemplates {
  mainIdeas: string;
  hardest: string;
  example: string;
  overview: string;
}

export interface MaterialForSuggestion {
  filename: string;
  /** The first sentence of the stored summary, or null when none exists. */
  lead?: string | null;
}

const FSI = '⁨';
const PDI = '⁩';

/** "Chapter 3.pdf" -> "Chapter 3". A name a student typed is left alone. */
export function materialTitle(filename: string): string {
  return filename.replace(/\.[a-z0-9]{1,5}$/i, '').trim() || filename;
}

/**
 * Whether a file name reads like a title: it has a space or Arabic letters,
 * is not mostly digits, and is not a single run of letters, digits and
 * dashes such as an export code. Conservative on purpose: a wrong "no" costs
 * a question about the subject; a wrong "yes" costs a nonsense question.
 */
export function looksLikeTitle(name: string): boolean {
  const t = materialTitle(name);
  if (t.length < 3 || t.length > 60) return false;
  const hasArabic = /[؀-ۿ]/.test(t);
  const hasSpace = /\s/.test(t);
  const digits = (t.match(/\d/g) ?? []).length;
  if (digits > 4) return false;
  if (/^[A-Za-z0-9_-]+$/.test(t) && !hasSpace) return false;
  return hasArabic || hasSpace;
}

/** The first sentence of a summary, trimmed to something a question can hold. */
export function summaryLead(summary: string | null | undefined, max = 70): string | null {
  if (!summary) return null;
  const first = summary.replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟。])\s/)[0] ?? '';
  const cut = first.length > max ? first.slice(0, max).replace(/\s+\S*$/, '') + '…' : first;
  return cut.length >= 8 ? cut : null;
}

/** The topic a question may name for this material, or null. */
export function materialTopic(m: MaterialForSuggestion): string | null {
  const lead = summaryLead(m.lead);
  if (lead) return lead;
  if (looksLikeTitle(m.filename)) return materialTitle(m.filename);
  return null;
}

export function askSuggestions(
  templates: SuggestionTemplates,
  subject: string,
  materials: MaterialForSuggestion[],
  max = 3
): string[] {
  const iso = (s: string) => `${FSI}${s}${PDI}`;
  const fill = (t: string, material?: string) =>
    t.replace('{subject}', iso(subject)).replace('{material}', iso(material ?? subject));
  const topics = materials.map(materialTopic).filter((t): t is string => Boolean(t));
  const out: string[] = [];
  if (topics[0]) out.push(fill(templates.mainIdeas, topics[0]));
  out.push(fill(templates.hardest));
  if (topics[1]) out.push(fill(templates.example, topics[1]));
  else if (topics[0]) out.push(fill(templates.example, topics[0]));
  else out.push(fill(templates.overview));
  return Array.from(new Set(out)).slice(0, max);
}
