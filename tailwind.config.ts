import type { Config } from 'tailwindcss'

const config: Config = {
  // Dark-ready: dark mode will be enabled later by toggling a `.dark` class that
  // overrides the CSS-variable token values. No dark palette shipped yet.
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Semantic color tokens — all resolve to CSS variables (see globals.css),
      // so switching to dark mode later needs no utility changes.
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
          subtle: 'var(--primary-subtle)',
        },
      },
      fontFamily: {
        // Rubik covers Latin + Arabic in one family (see src/app/[locale]/layout.tsx).
        sans: ['var(--font-rubik)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        // Token-backed; `rounded-xl` stays 0.75rem but changes with --radius.
        xl: 'var(--radius)',
      },
      boxShadow: {
        // Soft, calm elevation — no neon glow (D4).
        soft: '0 1px 2px rgba(16, 32, 26, 0.04), 0 1px 3px rgba(16, 32, 26, 0.06)',
        card: '0 2px 8px rgba(16, 32, 26, 0.06)',
      },
    },
  },
  plugins: [],
}

export default config
