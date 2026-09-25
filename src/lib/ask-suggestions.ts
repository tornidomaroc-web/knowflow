/**
 * SUGGESTED FIRST QUESTIONS FOR THE ASK SCREEN (register #85,
 * SIGNED_IN_FEATURES.md 2.3).
 *
 * Every leading study app opens its chat with something to press; KnowFlow
 * opened with "Start typing to ask questions." These are built on the client
 * from the subject's name and its material names, in the student's language,
 * and NOTHING is sent until one is pressed: a pressed suggestion becomes the
 * student's own message through the unchanged `/api/agent` path, counted
 * against the same daily cap and costing the same as a typed question.
 *
 * Pure, so the proof can hold it: three questions at most, the material
 * names cleaned of their extension, and a subject with no materials still
 * gets a question about itself.
 */
export interface SuggestionTemplates {
  mainIdeas: string;
  hardest: string;
  example: string;
  overview: string;
}

/** "Chapter 3.pdf" -> "Chapter 3". A name a student typed is left alone. */
export function materialTitle(filename: string): string {
  return filename.replace(/\.[a-z0-9]{1,5}$/i, '').trim() || filename;
}

export function askSuggestions(
  templates: SuggestionTemplates,
  subject: string,
  materialNames: string[],
  max = 3
): string[] {
  const fill = (t: string, material?: string) =>
    t.replace('{subject}', subject).replace('{material}', material ?? subject);
  const materials = materialNames.map(materialTitle).filter(Boolean);
  const out: string[] = [];
  if (materials[0]) out.push(fill(templates.mainIdeas, materials[0]));
  out.push(fill(templates.hardest));
  if (materials[1]) out.push(fill(templates.example, materials[1]));
  else if (materials[0]) out.push(fill(templates.example, materials[0]));
  else out.push(fill(templates.overview));
  return Array.from(new Set(out)).slice(0, max);
}
