import type { AuthErrorKey } from '@/lib/auth/auth-error';

/**
 * DRAFTS, AWAITING THE OWNER (docs/copy-drafts/auth_errors.md): the auth
 * forms' error sentences (audit cause #8) and the app's line under the
 * check-inbox notice (audit cause #3). They are NOT in the dictionaries, so
 * scripts/verify-arabic-copy.mjs (434 leaves, the approved set) is unchanged.
 *
 * On approval they move into ar.ts and en.ts as `auth.errors` and
 * `auth.checkInboxApp`, one batch row each in docs/copy/, and the readers
 * (`authErrorText` in src/lib/auth/auth-error.ts, the sign-up page) read the
 * dictionary instead of this file.
 *
 * Rules held: Modern Standard Arabic, short, no Latin word inside an Arabic
 * sentence, no plan, upgrade, price or free word, no em dash, Western digits.
 */
export type AuthCopyKey = Exclude<AuthErrorKey, 'sessionMissing'>;

export const AUTH_COPY_DRAFT: Record<'en' | 'ar', Record<AuthCopyKey, string>> = {
  en: {
    invalidCredentials: 'The email or password is not correct.',
    emailNotConfirmed: 'Your email is not confirmed yet. Open the link we sent you, then sign in.',
    weakPassword: 'This password is too weak. Choose a longer one that is harder to guess.',
    samePassword: 'Choose a password different from your current one.',
    invalidEmail: 'This email address cannot be used. Check it and try again.',
    emailRateLimit: 'We could not send the email right now. Wait a few minutes, then try again.',
    requestRateLimit: 'Too many attempts. Wait a few minutes, then try again.',
    network: 'We could not reach the server. Check your connection and try again.',
    generic: 'Something went wrong. Try again in a moment.',
  },
  ar: {
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    emailNotConfirmed: 'لم تؤكد بريدك الإلكتروني بعد. افتح الرابط الذي أرسلناه إليك، ثم سجّل الدخول.',
    weakPassword: 'كلمة المرور هذه ضعيفة. اختر كلمة أطول يصعب تخمينها.',
    samePassword: 'اختر كلمة مرور مختلفة عن كلمتك الحالية.',
    invalidEmail: 'لا يمكن استعمال هذا البريد الإلكتروني. تحقق منه وجرّب مرة أخرى.',
    emailRateLimit: 'لم نستطع إرسال الرسالة الآن. انتظر بضع دقائق، ثم جرّب مرة أخرى.',
    requestRateLimit: 'محاولات كثيرة. انتظر بضع دقائق، ثم جرّب مرة أخرى.',
    network: 'لم نستطع الوصول إلى الخادم. تحقق من اتصالك وجرّب مرة أخرى.',
    generic: 'حدث خطأ. جرّب مرة أخرى بعد قليل.',
  },
};

/** In the app only, under the check-inbox notice after sign-up (cause #3). */
export const CHECK_INBOX_APP_DRAFT: Record<'en' | 'ar', string> = {
  en: 'After you confirm from the email, come back to the app and sign in.',
  ar: 'بعد التأكيد من الرسالة، ارجع إلى التطبيق وسجّل الدخول.',
};
