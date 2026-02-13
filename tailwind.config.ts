import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f5f3f0",
          100: "#ece7e1",
          200: "#d8cfc4",
          300: "#b8a996",
          400: "#9b866f",
          500: "#846f57",
          600: "#6f5b46",
          700: "#5a4a3b",
          800: "#463a2f",
          900: "#362d26"
        },
        skywash: {
          50: "#f2f7fb",
          100: "#e3eef7",
          200: "#c0daee",
          300: "#98c1e2",
          400: "#6c9fd2",
          500: "#4b7fbe",
          600: "#3a649b",
          700: "#30517c",
          800: "#284161",
          900: "#20344c"
        },
        signal: {
          100: "#fef2c7",
          200: "#fbe28f",
          300: "#f6c453",
          400: "#f0a93b",
          500: "#e38a24",
          600: "#c86c18",
          700: "#a75316",
          800: "#844216",
          900: "#6a3614"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      boxShadow: {
        aura: "0 20px 60px -30px rgba(40, 65, 97, 0.6)",
        panel: "0 12px 30px -24px rgba(32, 52, 76, 0.8)"
      },
      backgroundImage: {
        "hero-grid": "radial-gradient(circle at top, rgba(72, 127, 190, 0.22), transparent 55%), radial-gradient(circle at 20% 20%, rgba(227, 138, 36, 0.18), transparent 55%)"
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" }
        }
      },
      animation: {
        "rise-in": "rise-in 0.6s ease-out",
        "pulse-soft": "pulse-soft 2.5s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
