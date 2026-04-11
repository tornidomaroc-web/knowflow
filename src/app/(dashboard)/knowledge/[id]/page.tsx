import { createClient } from '@/lib/supabase/server';
import { DropZone } from '@/components/upload/DropZone';
import { redirect } from 'next/navigation';

export default async function KnowledgeBaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: kb } = await supabase.from('knowledge_bases').select('*').eq('id', id).single();
  if (!kb) redirect('/dashboard/knowledge');

  const { data: docs } = await supabase.from('documents').select('*').eq('kb_id', id).order('created_at', { ascending: false });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'text-[var(--muted-color)]';
      case 'processing': return 'text-amber-400';
      case 'ready': return 'text-[var(--accent-color)]';
      case 'error': return 'text-red-500';
      default: return 'text-white';
    }
  };

  return (
    <div className="space-y-8 text-white max-w-4xl">
      <div>
        <h1 className="text-4xl font-[family-name:var(--font-playfair)] font-bold tracking-wider mb-2">
          {kb.name}
        </h1>
        <span className="bg-[var(--border-color)] text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs px-2 py-1 uppercase tracking-widest inline-block mb-4">
          {kb.language}
        </span>
        {kb.description && (
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm">
            {kb.description}
          </p>
        )}
      </div>

      <DropZone kbId={id} />

      <div>
        <h2 className="text-xl font-[family-name:var(--font-playfair)] font-bold mb-4">Documents</h2>
        {!docs || docs.length === 0 ? (
          <div className="border border-[var(--border-color)] bg-[#0c1510] text-center py-12">
            <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)]">No documents yet. Upload your first file.</p>
          </div>
        ) : (
          <div className="border border-[var(--border-color)] bg-[#0c1510] overflow-hidden">
            <table className="w-full text-left font-[family-name:var(--font-sans)] text-sm">
              <thead className="bg-[var(--bg-color)] font-[family-name:var(--font-mono)] text-[var(--muted-color)] text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-normal">Filename</th>
                  <th className="px-6 py-4 font-normal">Type</th>
                  <th className="px-6 py-4 font-normal">Status</th>
                  <th className="px-6 py-4 font-normal">Chunks</th>
                  <th className="px-6 py-4 font-normal">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[var(--bg-color)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{doc.filename}</td>
                    <td className="px-6 py-4 whitespace-nowrap uppercase font-[family-name:var(--font-mono)] text-[10px]">{doc.file_type}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${getStatusColor(doc.status)} font-[family-name:var(--font-mono)] uppercase text-[10px]`}>
                      {doc.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-[family-name:var(--font-mono)]">{doc.chunk_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-[var(--muted-color)]">{new Date(doc.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
