import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type BadgeVariant = 'primary' | 'neutral';

const badgeVariants: Record<BadgeVariant, string> = {
  primary: 'bg-primary-subtle text-primary', // emerald-700 on emerald-50 — high contrast
  neutral: 'bg-muted text-muted-foreground',
};

export function Badge({
  className,
  variant = 'primary',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
