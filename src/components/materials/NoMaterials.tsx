import { EmptyFiles } from '@/components/illustrations';

/**
 * Step Redesign-3: a subject with no files yet, drawn (VISUAL_LANGUAGE.md
 * rule 6: an illustration, a one-line reason). The one action, the upload
 * button or drop zone, sits right above it on the subject page, so this
 * carries no second button.
 */
export function NoMaterials({ text }: { text: string }) {
  return (
    <div data-kf-files-empty="" className="kf-card rise flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
      <EmptyFiles size={112} title={text} />
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
