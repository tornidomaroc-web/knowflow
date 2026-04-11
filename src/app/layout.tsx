import './globals.css';
import { ReactNode } from 'react';
import { Playfair_Display, DM_Mono, DM_Sans } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const dmMono = DM_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-mono' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="ltr" className={`${playfair.variable} ${dmMono.variable} ${dmSans.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --bg-color: #070d0a;
            --accent-color: #2eff8c;
            --border-color: #1a2e1e;
            --muted-color: #6b7d6e;
            --input-bg: #0c1510;
          }
        ` }} />
      </head>
      <body className="bg-[var(--bg-color)] text-white font-[family-name:var(--font-sans)] antialiased">
        {children}
      </body>
    </html>
  );
}
