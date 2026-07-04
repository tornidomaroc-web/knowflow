import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui';

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
      <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <h2 className="text-xl font-semibold text-foreground">{labels.title}</h2>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">{labels.prompt}</p>
        <Link href={newHref} className={buttonVariants({ variant: 'primary' })}>
          <Plus className="h-4 w-4" />
          {labels.cta}
        </Link>
      </div>
    </div>
  );
}
