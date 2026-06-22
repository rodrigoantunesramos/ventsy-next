/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca Ventsy — coral/rausch (âncora #ff385c)
        brand: {
          DEFAULT: "#ff385c",
          50: "#fff1f3",
          100: "#ffe4e8",
          200: "#fecdd6",
          300: "#fda4b4",
          400: "#fb7090",
          500: "#ff385c",
          600: "#e0304f",
          700: "#b91c3c",
          800: "#9f1239",
          900: "#881337",
          950: "#4c0519",
        },
        // Tinta / neutros de texto — agora via CSS vars (canais "R G B") para
        // adaptarem ao tema (claro/escuro) automaticamente, INCLUSIVE nas
        // variantes de opacidade (text-ink-muted/70 etc). Valores claros são
        // idênticos aos antigos #0d0d0d/#222/#6b7280 → zero mudança no claro.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        // Superfícies semânticas tema-aware (adoção incremental no painel).
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          alt: "rgb(var(--surface-alt) / <alpha-value>)",
        },
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        line: "var(--line)",
        // Acento dourado — antes só existia como var(--ouro), cravado à mão.
        ouro: {
          DEFAULT: "#f59e0b",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        pop: "0 12px 32px rgba(0,0,0,0.12)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
