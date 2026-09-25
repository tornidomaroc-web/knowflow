import Link from 'next/link';

/**
 * THE 404, ON THE PRODUCT'S OWN GROUND (register #101 held it as "the white
 * 404"). Next's default page loads none of the app's CSS and paints white,
 * which on a dark product reads as a crash. This one renders inside
 * `[locale]/layout.tsx`, so it has the tokens, the font and the theme.
 *
 * BILINGUAL BY DESIGN, NOT BY OMISSION. `not-found.tsx` receives no params, so
 * it cannot know which dictionary to read. A lost student is the one student
 * who may be on the wrong locale, so both sentences are printed, Arabic first
 * (the default locale), each with a way home in its own language. `dir` comes
 * from the layout, so the page mirrors correctly on either.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center text-foreground">
      <p className="text-2xl font-bold tracking-tight">
        Know<span className="text-primary">Flow</span>
      </p>
      <p className="mt-10 text-6xl font-bold text-primary">404</p>

      <div className="mt-8 space-y-6">
        <section lang="ar" dir="rtl">
          <h1 className="text-xl font-semibold">هذه الصفحة غير موجودة.</h1>
          <p className="mt-1 text-sm text-muted-foreground">ربما تغيّر عنوانها أو حُذفت.</p>
          <Link
            href="/ar"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            العودة إلى الصفحة الرئيسية
          </Link>
        </section>

        <section lang="en" dir="ltr">
          <h2 className="text-xl font-semibold">This page does not exist.</h2>
          <p className="mt-1 text-sm text-muted-foreground">It may have moved or been removed.</p>
          <Link
            href="/en"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-primary px-5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Back to the home page
          </Link>
        </section>
      </div>
    </main>
  );
}
