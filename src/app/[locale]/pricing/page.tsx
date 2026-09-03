'use client'
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { initializePaddle, Paddle, Environments } from '@paddle/paddle-js';
import { useTranslation, Locale } from '@/lib/i18n';

export default function PricingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  const supabase = createClient();

  /**
   * The BROWSER half of the Paddle environment. `src/lib/paddle.ts` made the
   * server half configuration-driven; this literal was left at 'production',
   * which meant a sandbox token asked PRODUCTION Paddle to open a checkout for
   * a transaction that only exists in sandbox. The server succeeded, the
   * overlay rendered "Something went wrong", the console said nothing, and the
   * server log knew nothing -- the failure was invisible from every side.
   *
   * PRODUCTION REMAINS THE DEFAULT, exactly as on the server: only the literal
   * string `sandbox` switches, so unset, empty, misspelled or differently-cased
   * values all resolve to production and no existing deployment moves.
   *
   * `NEXT_PUBLIC_` is required, not stylistic -- this runs in the browser, and
   * a bare `PADDLE_ENV` is not inlined into the client bundle. That is also why
   * this cannot read the server's variable: the two halves are configured
   * separately by construction, which is the whole reason this defect existed.
   */
  const paddleEnvironment: Environments =
    process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox' ? 'sandbox' : 'production';

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

    /**
     * WARNS, AND DELIBERATELY DOES NOT THROW. The server-side guard in
     * `src/lib/paddle.ts` refuses to start on a key/environment mismatch, and
     * that is right there: it fails three API routes closed. The same mechanism
     * here would be a WORSE trade, because this is a public marketing page --
     * throwing would blank /pricing for every visitor to prevent a checkout
     * error that only affects someone who clicks. So the mismatch is named
     * loudly and the page still renders.
     *
     * This exists because its absence cost a full diagnostic round: Paddle's
     * overlay reports a generic white box, our console was silent, and nothing
     * anywhere named the actual cause.
     */
    if (token) {
      const tokenIsSandbox = token.startsWith('test_');
      if (tokenIsSandbox !== (paddleEnvironment === 'sandbox')) {
        console.error(
          `[paddle] environment/token mismatch: NEXT_PUBLIC_PADDLE_ENV resolves to ` +
            `'${paddleEnvironment}' but the client token ` +
            `${tokenIsSandbox ? 'is' : 'is not'} a sandbox token ` +
            `(sandbox tokens start with 'test_'). Checkout will fail with a generic ` +
            `"Something went wrong" overlay until these agree.`
        );
      }
    }

    initializePaddle({
      environment: paddleEnvironment,
      token: token!
    }).then(setPaddle);
  }, [paddleEnvironment]);

  return (
    <div className="min-h-screen font-sans py-24" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-6 text-center mb-16">
        <h1 className="text-5xl font-bold tracking-tight mb-4">{t.pricing.title}</h1>
      </div>
      <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* FREE PLAN */}
        <div className={`rounded-2xl border border-border bg-surface shadow-soft p-8 flex flex-col ${isRtl ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-semibold mb-2">{t.pricing.free.name}</h2>
          <div className="text-3xl font-bold mb-6">{t.pricing.free.price}<span className="text-sm font-normal text-muted-foreground">{t.pricing.free.period}</span></div>
          <ul className="space-y-4 mb-8 flex-1 text-sm text-muted-foreground">
            {t.pricing.free.features.map((feature, idx) => (
              <li key={idx}>• {feature}</li>
            ))}
          </ul>
          <Link href={`/${locale}/signup`} className="block text-center rounded-xl border border-primary text-primary hover:bg-primary hover:text-primary-foreground py-3 text-sm font-semibold transition-colors">
            {t.pricing.free.button}
          </Link>
        </div>

        {/* PRO PLAN */}
        <div className={`rounded-2xl border-2 border-primary bg-surface shadow-card p-8 flex flex-col relative ${isRtl ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-semibold mb-2">{t.pricing.pro.name}</h2>
          <div className="text-3xl font-bold mb-6">{t.pricing.pro.price}<span className="text-sm font-normal text-muted-foreground">{t.pricing.pro.period}</span></div>
          <ul className="space-y-4 mb-8 flex-1 text-sm text-muted-foreground">
            {t.pricing.pro.features.map((feature, idx) => (
              <li key={idx}>• {feature}</li>
            ))}
          </ul>

          <div className="mt-auto">
            <button
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  window.location.href = `/${locale}/login`;
                  return;
                }
                setStatus('loading');
                try {
                  const res = await fetch('/api/paddle/checkout', { method: 'POST' });
                  const data = await res.json();
                  if (data.transactionId) {
                    paddle?.Checkout.open({ transactionId: data.transactionId });
                    setStatus('idle');
                  } else {
                    throw new Error(data.error || 'Failed to start checkout');
                  }
                } catch (err: any) {
                  setErrorMsg(err.message);
                  setStatus('error');
                }
              }}
              disabled={status === 'loading'}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>Processing...</>
              ) : t.pricing.pro.button}
            </button>
            {status === 'error' && (
              <p className="text-red-700 text-xs text-center mt-2">{errorMsg}</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
