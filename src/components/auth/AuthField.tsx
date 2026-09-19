'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The fields of the four auth pages: login, signup, forgot-password and
 * reset-password (#102).
 *
 * ============================================================================
 * WHAT THIS REPLACES
 * ============================================================================
 * Each page declared its own `fieldClass`, and the four copies were
 * byte-identical. None of them wired a label to its input (0 `htmlFor`, 0 `id`),
 * none set `autoComplete`, and the border was `border-border`: the dark
 * palette's white-at-9% catchlight, 1.29:1 on the card. Every field's fill
 * equals the card it sits on, so that hairline was the field's only edge, and
 * on the real signup page the three fields read as black rectangles on black.
 *
 * Login alone had a show-password toggle, and it was half built: an icon-only
 * button with no accessible name and `tabIndex={-1}`, so a keyboard could never
 * reach it and a screen reader announced it as "button". Signup and
 * reset-password had none.
 *
 * ============================================================================
 * WHAT EVERY FIELD NOW CARRIES
 * ============================================================================
 * - `border-control-border`, a token for a control's boundary rather than a
 *   divider, at 3.60:1 on the card (globals.css derives it, in all three
 *   scopes).
 * - A `<label>` bound to its `<input>` through `useId`, so clicking the label
 *   focuses the field and assistive technology announces it.
 * - Whatever `autoComplete` the page passes. The values follow the
 *   password-manager conventions: `username` + `current-password` to sign in,
 *   `username` + `new-password` to sign up, and `new-password` to reset.
 *
 * `PasswordField` adds the toggle. It follows the WAI-ARIA toggle-button
 * pattern: the label stays fixed ("Show password") and `aria-pressed` carries
 * the state, rather than a label that swaps under the user's hand. It is a real
 * `type="button"` in the tab order right after its input, and it is 44px wide
 * across the input's full height, so it meets the mobile tap floor this
 * codebase already uses for buttons.
 */

const FIELD =
  'w-full rounded-xl border border-control-border bg-input px-4 py-3 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring';

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { label: string };

export function AuthField({ label, className, ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input id={id} className={cn(FIELD, className)} {...props} />
    </div>
  );
}

type PasswordFieldProps = Omit<FieldProps, 'type'> & {
  /** The toggle's accessible name, from the dictionary: "Show password". */
  showLabel: string;
};

export function PasswordField({ label, showLabel, className, ...props }: PasswordFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          className={cn(FIELD, 'pe-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={showLabel}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
