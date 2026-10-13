/**
 * Step Redesign-3: the Ask screen's large title inside the app (the iOS
 * large-title size, `.kf-title`), as Home, Subjects and Settings open on
 * theirs. It does not grow or shrink: the conversation box below it takes
 * the rest of the screen's fixed height.
 */
export function AskTitle({ text }: { text: string }) {
  return <h1 className="kf-title mb-3 shrink-0 text-2xl font-bold text-foreground">{text}</h1>;
}
