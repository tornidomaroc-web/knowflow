import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { appleRootCertificates } from '@/lib/apple-iap/apple-root';
import { handleNotification } from '@/lib/apple-iap/handlers';
import { parseSandboxUserIds } from '@/lib/apple-iap/rules';

/**
 * POST /api/apple/notifications: App Store Server Notifications V2 (iOS 1.1,
 * item 4d). Apple posts `{ "signedPayload": "<JWS>" }`; there is no session
 * and no shared secret, because the JWS chain to the PINNED Apple Root CA - G3
 * IS the authentication: a payload that does not verify changes nothing. The
 * one URL serves Production and Sandbox (the owner enters it as both in App
 * Store Connect); Sandbox writes only for allowlisted accounts.
 *
 * Every rule (types, ordering, idempotency, unknown types never granting) is
 * in src/lib/apple-iap/handlers.ts.
 */
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: NextRequest) {
  let signedPayload: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'bad-request' }, { status: 413 });
    }
    signedPayload = (JSON.parse(raw) as { signedPayload?: unknown })?.signedPayload;
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof signedPayload !== 'string') return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    const result = await handleNotification(signedPayload, {
      admin: createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!),
      roots: appleRootCertificates(),
      sandboxUserIds: parseSandboxUserIds(process.env.APPLE_IAP_SANDBOX_USER_IDS),
      now: Date.now,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    // Unexpected (not a refusal, not a write error): 500 so Apple redelivers.
    console.error('Apple notification: handler threw', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
