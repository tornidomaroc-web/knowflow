import Link from 'next/link';
import { buttonVariants } from '@/components/ui';
import { ClayEmptyShelf, ClayPlus } from '@/components/clay/ClayIcons';

interface AgentEmptyStateLabels {
  title: string;
  prompt: string;
  cta: string;
}

export interface AgentEmptyStateProps {
  newHref: string;
  labels: AgentEmptyStateLabels;
}

/**
 * Shown when the student has no subjects yet — you can't ask before you've added
 * material. Dumb, presentational; the dashboard `<main>` (P2.7) owns the light
 * canvas + padding.
 */
export function AgentEmptyState({ newHref, labels }: AgentEmptyStateProps) {
  return (
    <div>
      {/* Design "C", PR 4: a clay card (no dashed edge) with the home's clay
          empty shelf, the same picture the empty home draws. */}
      <div data-kf-ask-zero="" className="kf-card rise mx-auto flex max-w-md flex-col items-center rounded-2xl bg-surface p-10 text-center">
        <ClayEmptyShelf title={labels.title} data-kf-clay-art="empty-ask" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">{labels.title}</h2>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">{labels.prompt}</p>
        <Link href={newHref} className={buttonVariants({ variant: 'primary' })}>
          <ClayPlus width={20} height={20} />
          {labels.cta}
        </Link>
      </div>
    </div>
  );
}
