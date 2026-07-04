import { Home, Library, MessageCircle, Settings, type LucideIcon } from 'lucide-react';

export interface NavLabels {
  dashboard: string;
  knowledge: string;
  agent: string;
  settings: string;
}

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Dashboard root matches exactly; section roots match their subtree. */
  exact: boolean;
}

export function getNavItems(locale: string, labels: NavLabels): NavItem[] {
  const root = `/${locale}/dashboard`;
  return [
    { key: 'dashboard', label: labels.dashboard, href: root, icon: Home, exact: true },
    { key: 'knowledge', label: labels.knowledge, href: `${root}/knowledge`, icon: Library, exact: false },
    { key: 'agent', label: labels.agent, href: `${root}/agent`, icon: MessageCircle, exact: false },
    { key: 'settings', label: labels.settings, href: `${root}/settings`, icon: Settings, exact: false },
  ];
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
