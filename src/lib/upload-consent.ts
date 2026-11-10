/**
 * ACTIVATION 5, AUDIT CAUSE #7: THE PICKED FILE AND THE AI PERMISSION SHEET.
 *
 * The permission (Apple 5.1.2(i), src/lib/ai-consent.ts) is asked the first
 * time a file is picked. Before this change the drop zone showed nothing while
 * the sheet was up (the file was invisible, so a student could not tell it was
 * still there), and "Not now" ended in the red failure box ("لم ينجح") with the
 * file input still holding the same file, so picking that file again fired no
 * change event and nothing happened.
 *
 * Now, as the owner decided: the picked file is HELD and shown (in the drop
 * zone and on the sheet) while the sheet is open; on "I agree" the upload of
 * that same file continues with no second pick; on "Not now" nothing is
 * uploaded or sent anywhere, the file is released (the input is emptied) and
 * the drop zone returns to its tile with the existing `declined` sentence, not
 * as a failure.
 *
 * WHY NOT ASK BEFORE THE PICKER. A file input opens only inside the tap that
 * asks for it (a user activation). "I agree" writes the permission to the
 * account first (an awaited network call), and once that await returns the
 * tap's activation is spent in WebKit, so the picker could not open from it:
 * the student would tap the tile, agree, then tap the tile AGAIN. Holding the
 * file costs no extra tap and sends nothing before the answer.
 *
 * Pure, so `scripts/verify-activation-5.mjs` holds it; DropZone follows it.
 */
export type ConsentStep<F> = {
  /** The file to send now, or null: nothing leaves the device. */
  send: F | null;
  /** The file the drop zone still shows, or null once released. */
  held: F | null;
  /** The drop zone's state after the answer. */
  state: 'uploading' | 'idle';
  /** The sentence shown with it: the existing `aiConsent.declined`, or none. */
  notice: 'declined' | null;
};

/** What the drop zone does with a held file once the sheet is answered. */
export function afterConsent<F>(held: F, granted: boolean): ConsentStep<F> {
  return granted
    ? { send: held, held, state: 'uploading', notice: null }
    : { send: null, held: null, state: 'idle', notice: 'declined' };
}

// The line under a held file while the sheet is open is approved copy
// (docs/copy/ARABIC_STRINGS_app_v8.md): `dashboard.upload.awaitingConsent`.
