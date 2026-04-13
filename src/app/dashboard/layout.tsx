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
      <input type="checkbox" id="mobile-sidebar" className="peer hidden" />
      
      <label htmlFor="mobile-sidebar" className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 border border-gray-700 rounded-md cursor-pointer text-white">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </label>

      <label htmlFor="mobile-sidebar" className="fixed inset-0 bg-black/50 hidden peer-checked:block md:hidden z-40 cursor-pointer"></label>

      <div className="fixed inset-y-0 left-0 bg-gray-900 w-[240px] transform -translate-x-full peer-checked:translate-x-0 md:translate-x-0 transition-transform z-50 md:z-0">
        <Sidebar userEmail={user.email || ''} />
      </div>
      <div className="flex-1 md:ml-[240px] p-8 pt-16 md:pt-8 w-full">
        {children}
      </div>
    </div>
  );
}
