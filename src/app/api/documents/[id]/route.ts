import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { deleteMaterial, materialDeletionFailed } from '@/lib/material-deletion';

/**
 * DELETE /api/documents/[id] -- delete one material. Register #47.
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
        : { file: result.file, shared_with: result.sharedWith }),
    })
  );

  const headers = { 'Cache-Control': 'no-store' };

  if (!materialDeletionFailed(result)) {
    // `file` says whether the stored file went with it. `kept-shared` means
    // another material in the same subject maps to the same stored file, which
    // is kept for it (see `@/lib/storage-key`).
    return NextResponse.json(
      { deleted: true, file: result.file, sharedWith: result.sharedWith },
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
