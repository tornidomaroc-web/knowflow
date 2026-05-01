'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/lib/i18n';

interface SidebarLabels {
  dashboard: string;
  knowledge: string;
  agent: string;
  settings: string;
  signOut: string;
}

export function Sidebar({
  userEmail,
  isPro,
  locale,
  labels,
}: {
  userEmail: string;
  isPro?: boolean;
  locale: Locale;
  labels: SidebarLabels;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  const navLinks = [
    { label: labels.dashboard, href: `/${locale}/dashboard` },
    { label: labels.knowledge, href: `/${locale}/dashboard/knowledge` },
    { label: labels.agent, href: `/${locale}/dashboard/agent` },
    { label: labels.settings, href: `/${locale}/dashboard/settings` },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0c1510] font-[family-name:var(--font-mono)] text-white p-6 border-r border-[var(--border-color)]">
      <div className="mb-12 cursor-default pointer-events-none">
        <h1 className="text-[1.1rem] font-[family-name:var(--font-playfair)] font-bold tracking-wider text-white">
          Know<span className="text-[var(--accent-color)]">Flow</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-2">
        {navLinks.map((link) => {
          const dashboardRoot = `/${locale}/dashboard`;
          const isActive =
            pathname === link.href ||
            (link.href !== dashboardRoot && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-4 py-2 text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
                isActive
                  ? 'text-[var(--accent-color)] border-l-2 border-[var(--accent-color)] bg-[var(--bg-color)]'
                  : 'text-[var(--muted-color)] border-l-2 border-transparent hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--border-color)] pt-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-[var(--muted-color)] text-[0.72rem] truncate" title={userEmail}>
            {userEmail}
          </div>
          {isPro && (
            <span className="shrink-0 text-[#070d0a] bg-[#2eff8c] font-[family-name:var(--font-mono)] text-[0.6rem] uppercase tracking-widest px-1.5 py-0.5">
              PRO
            </span>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-[0.72rem] text-white hover:text-[var(--accent-color)] uppercase tracking-widest transition-colors w-full text-left"
        >
          {labels.signOut}
        </button>
      </div>
    </div>
  );
}
