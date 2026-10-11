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
      colors: {
        primary: {
          DEFAULT: "#2F6FB5", // Primary button
          hover: "#255A94",   // Primary hover
          soft: "#DDEBF8",    // Primary soft badge / selected
          sky: "#8DBCE8",     // Soft blue decorative
          50: "#F4F8FC",      // Page background
          100: "#E9F1F9",     // Surface alt (sidebar, rows)
          200: "#DDEBF8",     // Primary soft
          300: "#D2E0EE",     // Border / divider
          400: "#8CBDF0",     // Dark mode primary button
          500: "#4D8FD8",
          600: "#2F6FB5",     // DEFAULT
          700: "#255A94",
          800: "#183049",     // Dark mode primary soft
          900: "#17283B",     // Text primary
          950: "#0E1620",     // Dark mode page background
        },
        accent: {
          DEFAULT: "#C4623F", // Soft coral
          soft: "#FCEBE4",
          dark: "#F2A98E",
          darkSoft: "#3B2219",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#E9F1F9",
          border: "#D2E0EE",
          dark: "#16212E",
          darkAlt: "#1F2D3E",
          darkBorder: "#2D3F54",
        },
        txt: {
          primary: "#17283B",
          secondary: "#52657A",
          darkPrimary: "#E6EEF6",
          darkSecondary: "#A5B6C8",
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
          DEFAULT: "#7C3AED",
          dark: "#C9B6FF",
        },
        secondary: "#F4F8FC",
        ink: "#17283B",
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
      boxShadow: {
        soft: "0 24px 80px -24px rgba(30, 111, 191, 0.18)",
        softer: "0 12px 40px -12px rgba(11, 21, 38, 0.12)",
        card: "0 8px 32px rgba(30, 111, 191, 0.08)",
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
