import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--primary)',
        background: 'var(--ink)',
        foreground: 'var(--paper)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--paper)',
        },
        secondary: {
          DEFAULT: 'var(--border)',
          foreground: 'var(--paper)',
        },
        destructive: {
          DEFAULT: 'var(--red)',
          foreground: 'var(--ink)',
        },
        muted: {
          DEFAULT: 'var(--ink-2)',
          foreground: 'var(--muted)',
        },
        accent: {
          DEFAULT: 'var(--primary-dim)',
          foreground: 'var(--paper)',
        },
        popover: {
          DEFAULT: 'var(--ink-2)',
          foreground: 'var(--paper)',
        },
        card: {
          DEFAULT: 'var(--ink-2)',
          foreground: 'var(--paper)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
