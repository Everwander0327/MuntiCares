/* eslint-env node */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '400px',
      },
      colors: {
        // Theme-aware semantic text colors (see index.css for the values).
        tertiary: 'var(--text-tertiary)',
        link: 'var(--text-link)',
        field: 'var(--field-border)',
        'on-primary': 'rgb(var(--on-primary-rgb) / <alpha-value>)',
        'neu-fg': 'rgb(var(--neu-dark-primary-fg-rgb) / <alpha-value>)',
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",         // Primary button
          hover: "rgb(var(--primary-hover-rgb) / <alpha-value>)",     // Primary hover
          soft: "rgb(var(--primary-soft-rgb) / <alpha-value>)",       // Primary soft badge / selected
          sky: "rgb(var(--primary-sky-rgb) / <alpha-value>)",         // Soft decorative accent
          50: "rgb(var(--surface-page) / <alpha-value>)",             // Page background
          100: "rgb(var(--surface-subtle) / <alpha-value>)",          // Surface alt (sidebar, rows)
          200: "rgb(var(--primary-soft-rgb) / <alpha-value>)",        // Primary soft
          300: "rgb(var(--surface-border) / <alpha-value>)",          // Border / divider
          400: "rgb(var(--primary-light-rgb) / <alpha-value>)",       // Dark mode highlight / badge text
          500: "rgb(var(--primary-mid-rgb) / <alpha-value>)",
          600: "rgb(var(--primary-rgb) / <alpha-value>)",             // DEFAULT
          700: "rgb(var(--primary-hover-rgb) / <alpha-value>)",
          800: "rgb(var(--primary-deep-rgb) / <alpha-value>)",        // Dark mode primary soft
          900: "rgb(var(--ink-rgb) / <alpha-value>)",                 // Text primary
          950: "rgb(var(--surface-dark-page-rgb) / <alpha-value>)",   // Dark mode page background
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft: "rgb(var(--accent-soft-rgb) / <alpha-value>)",
          dark: "rgb(var(--accent-dark-rgb) / <alpha-value>)",
          darkSoft: "rgb(var(--accent-dark-soft-rgb) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--surface-card-rgb) / <alpha-value>)",
          // Theme-aware surfaces; values live in index.css so light/dark swap
          // without a paired dark: class at every call site.
          page: "rgb(var(--surface-page) / <alpha-value>)",
          shell: "rgb(var(--surface-shell) / <alpha-value>)",
          subtle: "rgb(var(--surface-subtle) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
          alt: "rgb(var(--surface-subtle) / <alpha-value>)",
          dark: "rgb(var(--surface-dark-card-rgb) / <alpha-value>)",
          darkAlt: "rgb(var(--surface-dark-subtle-rgb) / <alpha-value>)",
          darkBorder: "rgb(var(--surface-dark-border-rgb) / <alpha-value>)",
        },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
        txt: {
          primary: "rgb(var(--ink-rgb) / <alpha-value>)",
          secondary: "rgb(var(--txt-secondary-rgb) / <alpha-value>)",
          darkPrimary: "rgb(var(--txt-dark-primary-rgb) / <alpha-value>)",
          darkSecondary: "rgb(var(--txt-dark-secondary-rgb) / <alpha-value>)",
        },
        success: {
          DEFAULT: "#2C7A55",
          soft: "#E1F3EA",
          dark: "#7DD3A3",
          darkSoft: "#14301F",
        },
        warning: {
          DEFAULT: "#9C5A06",
          soft: "#FFF1D6",
          dark: "#F1BD6B",
          darkSoft: "#34260E",
        },
        danger: {
          DEFAULT: "#BC3030",
          soft: "#FCE8E6",
          dark: "#F4918B",
          darkSoft: "#3C1B1A",
        },
        focusRing: {
          DEFAULT: "var(--focus-ring)",
          dark: "var(--focus-ring)",
        },
        secondary: "rgb(var(--surface-page) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Lexend"', '"Atkinson Hyperlegible Next"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Lexend"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        lexend: ['"Lexend"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        atkinson: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'nano': ['0.6875rem', { lineHeight: '0.9375rem' }],
        '3xs': ['0.5625rem', { lineHeight: '0.75rem' }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      // Named overlay ramp; values live in the :root block of src/index.css.
      zIndex: {
        chrome: 'var(--z-chrome)',
        popover: 'var(--z-popover)',
        dock: 'var(--z-dock)',
        shell: 'var(--z-shell)',
        overlay: 'var(--z-overlay)',
        toast: 'var(--z-toast)',
      },
      boxShadow: {
        soft: "0 24px 80px -24px rgb(var(--shadow-accent-rgb) / 0.18)",
        softer: "0 12px 40px -12px rgb(var(--ink-rgb) / 0.12)",
        card: "0 8px 32px rgb(var(--shadow-accent-rgb) / 0.08)",
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
