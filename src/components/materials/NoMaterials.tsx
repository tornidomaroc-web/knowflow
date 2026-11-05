import { ClayFile } from '@/components/clay/ClayIcons';

/**
 * Step Redesign-3: a subject with no files yet, drawn (VISUAL_LANGUAGE.md
 * rule 6: an illustration, a one-line reason). The one action, the upload
 * tile or drop zone, sits right above it on the subject page, so this
 * carries no second button.
 *
 * Design "C", PR 3: a pressed-in clay well (no dashed border) with the clay
 * page, named by the line under it.
 */
export function NoMaterials({ text }: { text: string }) {
  return (
    <div data-kf-files-empty="" className="kf-well rise flex flex-col items-center rounded-3xl p-8 text-center">
      <ClayFile width={64} height={64} role="img" aria-hidden={undefined} aria-label={text} />
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
