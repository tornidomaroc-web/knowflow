import { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen text-white bg-black">
      <div className="w-[240px] fixed inset-y-0 left-0 bg-gray-900">
        <Sidebar userEmail={user.email || ''} />
      </div>
      <div className="flex-1 ml-[240px] p-8">
        {children}
      </div>
    </div>
  );
}
