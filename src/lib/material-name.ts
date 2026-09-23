/**
 * THE NAME A STUDENT MAY GIVE A MATERIAL (register #47, rename).
 *
 * The student edits the name WITHOUT its extension; the extension of the
 * current filename is kept exactly as it is, so a material's name can never
 * claim a different type than `documents.file_type` records. The rename control
 * (`RenameMaterialControl`) and the route (`/api/documents/[id]`, PATCH) both
 * call these functions, so the browser and the server cannot disagree about
 * where the extension starts.
 *
 * The filename is DISPLAY ONLY once a rename is possible: the stored file is
 * located by `documents.storage_path`, which rename writes for a pre-#110 row
 * before the name changes (`material-rename.ts`). So the name rules below are
 * about what reads sensibly as a filename, not about storage safety.
 */

/** Longest filename a rename may produce, extension included, in UTF-16 units. */
export const MAX_MATERIAL_FILENAME_LENGTH = 200;

/**
 * `Notes.pdf` -> { stem: 'Notes', ext: '.pdf' }. The extension is everything
 * from the LAST dot, when that dot is not the first character. `pdf` and
 * `.hidden` have no extension, and `a.b.pdf` keeps `a.b` as its stem.
 */
export function splitFilename(filename: string): { stem: string; ext: string } {
  const i = filename.lastIndexOf('.');
  return i > 0 ? { stem: filename.slice(0, i), ext: filename.slice(i) } : { stem: filename, ext: '' };
}

export type RenamedFilename =
  | { ok: true; filename: string }
  | { ok: false; reason: 'empty' | 'control-character' | 'slash' | 'too-long' };

/** `strict: false` (register #41) will not narrow on `ok`; a predicate does. */
export function renameRefused(r: RenamedFilename): r is Extract<RenamedFilename, { ok: false }> {
  return !r.ok;
}

/**
 * The filename a rename produces from the student's input, or why it cannot.
 *
 * The input is trimmed. If the student typed the extension anyway, it is not
 * doubled: `Lecture 1.pdf` typed against `Notes.pdf` gives `Lecture 1.pdf`, not
 * `Lecture 1.pdf.pdf`, and the CURRENT extension's spelling (`.PDF` stays
 * `.PDF`) is the one kept. Refused: an empty name, a control character, a `/`
 * or `\` (a filename is not a path), and anything longer than
 * MAX_MATERIAL_FILENAME_LENGTH once the extension is added back.
 */
export function renamedFilename(currentFilename: string, input: string): RenamedFilename {
  const { ext } = splitFilename(currentFilename);
  let stem = (input ?? '').trim();
  if (ext && stem.toLowerCase().endsWith(ext.toLowerCase())) {
    stem = stem.slice(0, stem.length - ext.length).trim();
  }
  if (!stem) return { ok: false, reason: 'empty' };
  if (/[\x00-\x1f\x7f]/.test(stem)) return { ok: false, reason: 'control-character' };
  if (/[/\\]/.test(stem)) return { ok: false, reason: 'slash' };
  const filename = stem + ext;
  if (filename.length > MAX_MATERIAL_FILENAME_LENGTH) return { ok: false, reason: 'too-long' };
  return { ok: true, filename };
}
