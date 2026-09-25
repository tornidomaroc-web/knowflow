/**
 * WHICH PROVIDER BUTTONS ARE SHOWN (register #121, defect 1; register #119).
 *
 * Sign in with Apple shipped with its code path live and its provider not
 * yet registered, so a student who tapped it hit Supabase's refusal. The
 * button is now shown only when this build-time flag says the provider is
 * enabled. The owner sets `NEXT_PUBLIC_APPLE_SIGNIN=enabled` in the Vercel
 * project once the seven console steps in #119 are done and redeploys;
 * nothing in the code changes, and the button appears on the next build.
 *
 * Build-time on purpose: the auth pages are client components rendered on
 * every request, and a `NEXT_PUBLIC_` value is inlined into the bundle, so
 * the web and the native shell (which sets its own env at build) each carry
 * their own answer. Any value other than `enabled` hides the button.
 */
export const APPLE_SIGNIN_ENABLED: boolean = process.env.NEXT_PUBLIC_APPLE_SIGNIN === 'enabled';
