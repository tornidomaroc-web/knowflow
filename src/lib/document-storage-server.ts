/**
 * A MATERIAL'S STORED FILE IS WRITTEN BY THE SERVER, NEVER BY THE STUDENT.
 * (Storage insert lockdown, stage 1. Proof: scripts/verify-storage-server-writes.mjs.)
 *
 * supabase/migrations/002_storage.sql lets a signed-in student INSERT any
 * object whose first path segment is their own id. /api/ingest, /api/page-read
 * (through `ingestMaterial`) and /api/sample used that policy with the
 * student's session, so it could not be narrowed, and the same policy let
 * anyone signed in call the Storage API directly and store unlimited objects
 * of any size under their prefix, which nothing removed (students have no
 * delete policy). Stage 2 (supabase/migrations/20261118_storage_insert_lockdown.sql,
 * applied by hand once this code is live) narrows the student's INSERT to the
 * camera's `{uid}/page-photos/{uuid}/{name}` keys.
 *
 * So the bytes now go up with the service role, and what the session's policy
 * used to guarantee is checked here first, on the server, before any write:
 *   1. the key is `{userId}/{kbId}/{documentId}/{name}` with THIS caller's id
 *      first (the policy's rule) and THIS subject second;
 *   2. the subject is the caller's: read under the student's own session (RLS:
 *      knowledge_bases is owner-only) AND filtered on user_id. The policy never
 *      checked this; the documents insert after the upload did, too late, so a
 *      foreign subject id left a file with no row.
 * Only then is a service-role client made. Everything else about the upload
 * is the caller's and unchanged: the key, the body, `upsert: false`, the
 * content type (when the caller gives one).
 *
 * The service client is built as page-reader-server.ts builds it, and only
 * on the server: this module must never be imported by a client component.
 */
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { DOCUMENTS_BUCKET } from '@/lib/storage-key';

const UUID_LOWER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_ANY_CASE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The name part as `safeStorageName` writes it (or `upload`): flat, no leading dot.
const NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** The session client's one read used here (any `@/lib/supabase/server` client fits). */
export interface SubjectReader {
  from: (table: 'knowledge_bases') => {
    select: (cols: 'id') => {
      eq: (col: 'id', v: string) => {
        eq: (col: 'user_id', v: string) => {
          maybeSingle: () => PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

export type StoreRefusal = 'foreign-key' | 'foreign-subject' | 'subject-unread' | 'not-configured' | 'storage';
/** `message` is empty when ok; otherwise the logged cause (never shown to the student). */
export interface StoreResult { ok: boolean; reason?: StoreRefusal; message: string }

/**
 * Whether `key` is a material's key for this caller and this subject:
 * `{userId}/{kbId}/{documentId}/{name}`, four segments, the user id a
 * lower-case UUID (the storage policies compare the lower-case text), the
 * subject and document ids UUIDs, one flat name. The subject is compared as
 * the caller gave it, because the key is built from that same value.
 */
export function ownDocumentKey(userId: string, kbId: string, key: string): boolean {
  if (!UUID_LOWER.test(userId) || !UUID_ANY_CASE.test(kbId)) return false;
  const parts = key.split('/');
  return parts.length === 4 && parts[0] === userId && parts[1] === kbId && UUID_ANY_CASE.test(parts[2]) && NAME.test(parts[3]);
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The subject is the caller's, read under their own session. */
async function ownSubject(session: unknown, userId: string, kbId: string): Promise<StoreResult> {
  const { data, error } = await (session as SubjectReader)
    .from('knowledge_bases')
    .select('id')
    .eq('id', kbId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, reason: 'subject-unread', message: `the subject was not read: ${error.message}` };
  if (!data || data.id.toLowerCase() !== kbId.toLowerCase()) {
    return { ok: false, reason: 'foreign-subject', message: 'the subject is not the caller\'s' };
  }
  return { ok: true, message: '' };
}

/**
 * Store a material's file at `key` with the service role, after the key and
 * the subject are proved the caller's. `upsert` is always false. Never
 * throws; the caller decides what a refusal answers (both callers answer as
 * they did for a storage error, so the student sees nothing new).
 */
export async function storeOwnDocumentFile(input: {
  /** The student's session client, used ONLY to read the subject under RLS. */
  session: unknown;
  userId: string;
  kbId: string;
  key: string;
  body: Blob | ArrayBuffer | ArrayBufferView;
  contentType?: string;
}): Promise<StoreResult> {
  try {
    const { userId, kbId, key } = input;
    if (!ownDocumentKey(userId, kbId, key)) {
      return { ok: false, reason: 'foreign-key', message: 'the key is not under the caller\'s subject' };
    }
    const subject = await ownSubject(input.session, userId, kbId);
    if (!subject.ok) return subject;
    const admin = serviceClient();
    if (!admin) return { ok: false, reason: 'not-configured', message: 'service role not configured' };
    const options = input.contentType === undefined ? { upsert: false } : { upsert: false, contentType: input.contentType };
    const { error } = await admin.storage.from(DOCUMENTS_BUCKET).upload(key, input.body, options);
    if (error) return { ok: false, reason: 'storage', message: error.message };
    return { ok: true, message: '' };
  } catch (e) {
    return { ok: false, reason: 'storage', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Remove a material's file this request stored, with the service role, and
 * check it went (storage answers a key it did not delete with nothing, not an
 * error). Only a key under the caller's subject is ever removed. Never throws;
 * a file left behind is logged with the tag `kf-storage-left` (account
 * deletion still sweeps the whole user folder).
 */
export async function removeOwnDocumentFile(userId: string, kbId: string, key: string): Promise<boolean> {
  const left = (reason: string) => {
    console.error(JSON.stringify({ tag: 'kf-storage-left', reason, key }));
    return false;
  };
  if (!ownDocumentKey(userId, kbId, key)) return left('the key is not under the caller\'s subject');
  try {
    const admin = serviceClient();
    if (!admin) return left('service role not configured');
    const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).remove([key]);
    if (error) return left(error.message);
    return (data?.length ?? 0) === 1 ? true : left('storage removed nothing');
  } catch (e) {
    return left(e instanceof Error ? e.message : String(e));
  }
}
