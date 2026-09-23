import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { deleteMaterial, materialDeletionFailed } from '@/lib/material-deletion';
import { renameMaterial, materialRenameFailed } from '@/lib/material-rename';

/**
 * DELETE /api/documents/[id] -- delete one material. Register #47.
 * (PATCH, rename, is below; it shares this guard and uses no service role.)
 *
 * The user id comes from `auth.getUser()` and never from the request, and the
 * document is looked up through the user's own session first, so another
 * user's document id answers 404 exactly as a missing one does. The order and
 * what is (and is not) removed are documented in `@/lib/material-deletion`.
 *
 * The service-role client is used for ONE thing, the stored file: storage has
 * upload and read policies only (`002_storage.sql`), so a user's own session
 * cannot remove their own file. It is used only after RLS has confirmed the
 * row is theirs, and the path is built from the session's own id.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await deleteMaterial(supabase, admin, user.id, id);

  // ONE STRUCTURED LINE PER ATTEMPT, tagged like `kf-usage`. No filename is
  // logged: the ids are enough to find the rows, and a filename is the
  // student's own words.
  console.log(
    JSON.stringify({
      tag: 'kf-material-delete',
      user_id: user.id,
      document_id: id,
      ok: result.ok,
      ...(materialDeletionFailed(result)
        ? { stage: result.stage, reason: result.reason }
        : { file: result.file, shared_with: result.sharedWith, evidence: result.evidence }),
    })
  );

  const headers = { 'Cache-Control': 'no-store' };

  if (!materialDeletionFailed(result)) {
    // `file` says whether the stored file went with it. `kept-shared` means
    // another material in the same subject maps to the same stored file, which
    // is kept for it (see `@/lib/storage-key`). `evidence` is counts only, taken
    // with the service role before and after: it is how a delete is witnessed,
    // because the user's own session cannot see an orphaned quiz.
    return NextResponse.json(
      { deleted: true, file: result.file, sharedWith: result.sharedWith, evidence: result.evidence },
      { headers }
    );
  }

  if (result.stage === 'not-found') {
    return NextResponse.json({ error: 'NotFound' }, { status: 404, headers });
  }

  // A state, not a fault, and retrying cannot change it. Nothing was touched.
  if (result.stage === 'unresolvable-key') {
    return NextResponse.json({ error: 'StorageKeyUnresolvable' }, { status: 409, headers });
  }

  // `lookup` and `storage` touched nothing; `row` removed only the file. A retry
  // is safe and finishes the job in every case.
  return NextResponse.json({ error: 'DeletionFailed', stage: result.stage }, { status: 500, headers });
}

/**
 * PATCH /api/documents/[id] -- rename one material. Register #47.
 *
 * Body: `{ "name": "<new name without its extension>" }`. The server keeps the
 * current extension (`@/lib/material-name`) and returns the resulting filename.
 *
 * The same guard as DELETE: the user id comes from `auth.getUser()`, and the
 * row is read through the user's own session first, so another user's document
 * id answers 404 exactly as a missing one does. Unlike DELETE there is NO
 * service-role client here: a rename is one row update through the session,
 * and no stored file is moved or touched. Why a pre-#110 row gets its
 * `storage_path` written in the same update is in `@/lib/material-rename`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers = { 'Cache-Control': 'no-store' };

  let name: unknown;
  try {
    name = (await request.json())?.name;
  } catch {
    return NextResponse.json({ error: 'InvalidName', reason: 'body is not JSON' }, { status: 400, headers });
  }
  if (typeof name !== 'string') {
    return NextResponse.json({ error: 'InvalidName', reason: 'name is not a string' }, { status: 400, headers });
  }

  const { id } = await params;
  const result = await renameMaterial(supabase, user.id, id, name);

  // ONE STRUCTURED LINE PER ATTEMPT, like `kf-material-delete`. Neither the old
  // nor the new name is logged: a filename is the student's own words.
  console.log(
    JSON.stringify({
      tag: 'kf-material-rename',
      user_id: user.id,
      document_id: id,
      ok: result.ok,
      ...(materialRenameFailed(result)
        ? { stage: result.stage, reason: result.reason }
        : { unchanged: result.unchanged, path_written: result.pathWritten }),
    })
  );

  if (!materialRenameFailed(result)) {
    // `pathWritten`: this rename persisted a pre-#110 row's storage key.
    return NextResponse.json(
      {
        renamed: !result.unchanged,
        unchanged: result.unchanged,
        filename: result.filename,
        pathWritten: result.pathWritten,
      },
      { headers }
    );
  }

  if (result.stage === 'not-found') {
    return NextResponse.json({ error: 'NotFound' }, { status: 404, headers });
  }
  if (result.stage === 'invalid-name') {
    return NextResponse.json({ error: 'InvalidName', reason: result.reason }, { status: 400, headers });
  }
  // A conflict clears on reload: the row changed between the read and the write.
  if (result.stage === 'conflict') {
    return NextResponse.json({ error: 'Conflict' }, { status: 409, headers });
  }
  // States, not faults: retrying cannot change either. Nothing was changed.
  if (result.stage === 'path-taken') {
    return NextResponse.json({ error: 'PathTaken' }, { status: 409, headers });
  }
  if (result.stage === 'unresolvable-key') {
    return NextResponse.json({ error: 'StorageKeyUnresolvable' }, { status: 409, headers });
  }
  // `lookup` and `update`: one statement at most was attempted, and it failed,
  // so nothing changed and a retry is safe.
  return NextResponse.json({ error: 'RenameFailed', stage: result.stage }, { status: 500, headers });
}
