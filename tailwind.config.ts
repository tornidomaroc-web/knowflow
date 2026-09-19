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
        // A control's boundary (#102), kept apart from `border`, which is a
        // divider. `border-control-border`. Defined in all three scopes.
        'control-border': 'var(--control-border)',
        ring: 'var(--ring)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
          subtle: 'var(--primary-subtle)',
          // The notice box's edge (#104), `border-primary-border`. An opacity
          // modifier (`border-primary/30`) is never generated for a bare var().
          border: 'var(--primary-border)',
        },
        // Added for the #85 dark system. Only what the student home needs:
        // a THIRD surface level (page -> surface -> raised), the gold accent,
        // a third text level, and the two STATE colours. Every one resolves to
        // a CSS variable like the tokens above, so the light half of the toggle
        // is a value swap in globals.css and never a change here.
        raised: 'var(--raised)',
        faint: 'var(--faint)',
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
        },
        success: 'var(--success)',
        // `danger` became an object when the sweep landed: the 33 danger-family
        // utilities it replaced were a text colour, a fill AND a border, so a
        // single flat colour could not absorb them.
        danger: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--danger-foreground)',
          subtle: 'var(--danger-subtle)',
          border: 'var(--danger-border)',
        },
        warning: 'var(--warning)',
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
