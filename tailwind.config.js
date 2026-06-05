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
        // Tinta / neutros de texto
        ink: {
          DEFAULT: "#0d0d0d",
          soft: "#222222",
          muted: "#6b7280",
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
    },
  },
  plugins: [],
};
