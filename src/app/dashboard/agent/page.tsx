import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { KBSelector } from '@/components/agent/KBSelector';

export default async function AgentPage() {
  const supabase = await createClient();
  
  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('*')
    .order('created_at', { ascending: false });

  if (!kbs || kbs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-white border border-[var(--border-color)] bg-[#0c1510]">
        <h2 className="text-xl font-[family-name:var(--font-playfair)] mb-4">No Knowledge Bases Found</h2>
        <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] mb-6">You need to create a knowledge base before using the agent.</p>
        <Link href="/dashboard/knowledge/new" className="bg-[var(--accent-color)] text-[#070d0a] px-6 py-2 font-[family-name:var(--font-mono)] uppercase text-xs tracking-widest">
          Create Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div className="text-white space-y-6 mx-auto h-full flex flex-col">
      <h1 className="text-4xl font-[family-name:var(--font-playfair)] font-bold tracking-wider">
        Agent
      </h1>
      <KBSelector kbs={kbs} />
    </div>
  );
}
