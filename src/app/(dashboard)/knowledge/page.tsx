import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function KnowledgeBasesPage() {
  const supabase = await createClient();
  
  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="text-white space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-[family-name:var(--font-playfair)] font-bold tracking-wider">
          Knowledge Bases
        </h1>
        <Link
          href="/dashboard/knowledge/new"
          className="bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-sans)] font-bold px-6 py-2 hover:opacity-90 transition-opacity"
        >
          + New
        </Link>
      </div>

      {!kbs || kbs.length === 0 ? (
        <div className="bg-[#0c1510] border border-[var(--border-color)] p-12 text-center">
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] mb-4">
            No knowledge bases yet. Create your first one.
          </p>
          <Link
            href="/dashboard/knowledge/new"
            className="inline-block border border-[var(--accent-color)] text-[var(--accent-color)] font-[family-name:var(--font-sans)] px-6 py-2 hover:bg-[var(--accent-color)] hover:text-[#070d0a] transition-colors"
          >
            Create Base
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              href={`/dashboard/knowledge/${kb.id}`}
              className="group block bg-[#0c1510] border border-[var(--border-color)] p-6 hover:border-[var(--accent-color)] transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-[family-name:var(--font-playfair)] font-bold group-hover:text-[var(--accent-color)] transition-colors">
                  {kb.name}
                </h3>
                <span className="text-[0.65rem] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[#070d0a] bg-[var(--accent-color)] px-2 py-1 rounded-sm">
                  {kb.language}
                </span>
              </div>
              <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm mb-6 line-clamp-2 min-h-[2.5rem]">
                {kb.description || 'No description provided.'}
              </p>
              <div className="text-[0.7rem] font-[family-name:var(--font-mono)] text-[var(--border-color)]">
                Created: {new Date(kb.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
