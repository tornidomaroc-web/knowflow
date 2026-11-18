import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { appleRootCertificates } from '@/lib/apple-iap/apple-root';
import { verifyPurchase } from '@/lib/apple-iap/handlers';
import { parseSandboxUserIds } from '@/lib/apple-iap/rules';

/**
 * POST /api/apple/iap/verify (iOS 1.1, item 4d, server half; no screen calls
 * it yet). Body: `{ "signedTransaction": "<StoreKit 2 jwsRepresentation>" }`.
 *
 * The signed-in student's own purchase or restore becomes Pro once the JWS
 * verifies to the PINNED Apple Root CA - G3 and names this account; every
 * rule is in src/lib/apple-iap/handlers.ts. The root is the module constant:
 * this route has no way to accept another one.
 *
 * Answers carry codes, never sentences (the app's UI PR owns the copy), and
 * are never cached.
 */
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 32 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  let signedTransaction: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'bad-request' }, { status: 413, headers: NO_STORE });
    }
    signedTransaction = (JSON.parse(raw) as { signedTransaction?: unknown })?.signedTransaction;
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400, headers: NO_STORE });
  }
  if (typeof signedTransaction !== 'string') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400, headers: NO_STORE });
  }

  const result = await verifyPurchase(
    { signedTransaction, userId: user.id },
    {
      admin: createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!),
      roots: appleRootCertificates(),
      sandboxUserIds: parseSandboxUserIds(process.env.APPLE_IAP_SANDBOX_USER_IDS),
      now: Date.now,
    }
  );
  return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
}
