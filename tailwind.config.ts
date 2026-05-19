import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'var(--font-color, #ffffff)',
        },
        secondary: {
          DEFAULT: 'var(--secondary, #1e429f)',
          foreground: 'var(--font-color, #ffffff)',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        success: {
          DEFAULT: '#16A34A',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B',
          foreground: '#FFFFFF',
        },
        info: {
          DEFAULT: '#0EA5E9',
          foreground: '#FFFFFF',
        },
        sidebar: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
          primary: 'rgb(var(--color-primary, 13 148 136) / <alpha-value>)',
          'primary-foreground': '#FFFFFF',
          accent: '#F1F5F9',
          'accent-foreground': '#0F172A',
          border: '#E2E8F0',
          ring: 'rgb(var(--color-primary, 13 148 136) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: '20px',
        md: '14px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['"DM Sans"', ...fontFamily.sans],
        display: ['"Bricolage Grotesque"', '"DM Sans"', ...fontFamily.sans],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
