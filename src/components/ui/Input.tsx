import { cn } from '@/lib/utils';
import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          // 16 px below md: iOS zooms the page into any field under 16 px on
          // focus, and the zoom stays (Guideline 4.0; see AuthField.tsx).
          'h-11 w-full rounded-xl border border-border bg-input px-4 text-base md:text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
