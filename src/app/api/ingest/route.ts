import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kbId = formData.get('kb_id') as string;

    if (!file || !kbId) {
      return NextResponse.json({ success: false, error: 'Missing file or kb_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Upload file to Supabase Storage
    const filePath = `${user.id}/${kbId}/${file.name}`;
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: true });

    if (storageError) {
      return NextResponse.json({ success: false, error: storageError.message }, { status: 500 });
    }

    // Insert document record
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        kb_id: kbId,
        filename: file.name,
        file_type: file.name.split('.').pop() || 'unknown',
        status: 'processing'
      })
      .select()
      .single();

    if (docError || !docRecord) {
      return NextResponse.json({ success: false, error: docError?.message }, { status: 500 });
    }

    // Call Python service
    const pythonServiceUrl = process.env.INGESTION_SERVICE_URL || 'http://localhost:8000';
    const pyFormData = new FormData();
    pyFormData.append('file', file);

    const pyResponse = await fetch(`${pythonServiceUrl}/convert`, {
      method: 'POST',
      body: pyFormData
    });

    if (!pyResponse.ok) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    const result = await pyResponse.json();
    const wordCount = result.markdown ? result.markdown.split(/\s+/).length : 0;
    const chunkCount = Math.floor(wordCount / 100);

    // On success
    await supabase
      .from('documents')
      .update({
        markdown_content: result.markdown,
        status: 'ready',
        chunk_count: chunkCount
      })
      .eq('id', docRecord.id);

    return NextResponse.json({ success: true, document_id: docRecord.id, chunk_count: chunkCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
