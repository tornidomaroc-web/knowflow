import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[var(--bg-color)] min-h-screen">
      {children}
    </div>
  );
}
