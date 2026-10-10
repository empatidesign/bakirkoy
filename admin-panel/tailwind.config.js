/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'foreground-default': 'hsl(var(--foreground-default))',
        'foreground-strong':  'hsl(var(--foreground-strong))',
        'foreground-muted':   'hsl(var(--foreground-muted))',
        'foreground-subtle':  'hsl(var(--foreground-subtle))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
          soft: 'hsl(var(--danger-soft))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          soft: 'hsl(var(--info-soft))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          0: 'hsl(var(--surface-0))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
        },
        accent: {
          blue:          'hsl(var(--accent-blue))',
          green:         'hsl(var(--accent-green))',
          orange:        'hsl(var(--accent-orange))',
          violet:        'hsl(var(--accent-violet))',
          pink:          'hsl(var(--accent-pink))',
          'blue-soft':   'hsl(var(--accent-blue-soft))',
          'green-soft':  'hsl(var(--accent-green-soft))',
          'orange-soft': 'hsl(var(--accent-orange-soft))',
          'violet-soft': 'hsl(var(--accent-violet-soft))',
          'pink-soft':   'hsl(var(--accent-pink-soft))',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        field: 'var(--radius-field)',
        card:  'var(--radius-card)',
        panel: 'var(--radius-panel)',
        pill:  'var(--radius-pill)',
      },
      boxShadow: {
        card:  'var(--shadow-card)',
        pop:   'var(--shadow-pop)',
        panel: 'var(--shadow-panel)',
        modal: 'var(--shadow-modal)',
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)',
        'gradient-library': 'var(--gradient-library)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs:   ['var(--text-xs)',   { lineHeight: '1.5' }],
        sm:   ['var(--text-sm)',   { lineHeight: '1.5' }],
        base: ['var(--text-base)', { lineHeight: '1.5' }],
        lg:   ['var(--text-lg)',   { lineHeight: '1.4' }],
        xl:   ['var(--text-xl)',   { lineHeight: '1.35' }],
        '2xl':['var(--text-2xl)', { lineHeight: '1.25' }],
        '3xl':['var(--text-3xl)', { lineHeight: '1.2' }],
      },
      keyframes: {
        'row-flash': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'hsl(var(--warning) / 0.35)' },
        },
      },
      animation: {
        'row-flash': 'row-flash 1s ease-in-out 3',
      },
    },
  },
  plugins: [],
}
