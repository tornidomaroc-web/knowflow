/**
 * THE HOME'S CARD ORDER (activation fix 2, the 2026-11-09 audit, cause #4).
 *
 * The one account that gave the AI permission did it 39 seconds before it had
 * any subject: it acted on the Ask card at the top of an empty home, had
 * nothing to ask about, and never reached a file. The "Three steps to your
 * first answer" card sat near the bottom of the first screen.
 *
 * So while the student has NO material, the steps card is the first card
 * under the greeting and the Ask card follows it. "No material" is exactly
 * the rule step 2 ("upload") uses for done (`materials > 0`, `buildOnboarding`
 * in `@/lib/home-props`), read from that step so the two can never disagree.
 * From the first material on, the home keeps its order. With no steps at all
 * (a caller that passes none), nothing moves.
 */
export function homeStepsFirst(onboarding: readonly { key: string; done: boolean }[]): boolean {
  return onboarding.some((s) => s.key === 'upload' && !s.done)
}
