import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "14px",
        xl: "20px",
        "2xl": "24px",
        pill: "9999px"
      },
      keyframes: {
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "slide-up": "slideUp 260ms ease-out forwards"
      },
      colors: {
        lime: {
          ...colors.lime,
          300: "#7fff5f",
          700: "#1d6610"
        },
        teal: {
          ...colors.teal,
          50: "#e8f5f2",
          100: "#c5ded6",
          200: "#8fbfb8",
          300: "#5a9990",
          400: "#2f6b62",
          500: "#45887c",
          600: "#2a5a52",
          700: "#224843",
          800: "#1a3d38",
          850: "#122f2b",
          900: "#0d2b27",
          950: "#081f1c"
        },
        amber: {
          DEFAULT: "#ffd166"
        },
        danger: {
          DEFAULT: "#c0392b",
          hover: "#a93226",
          press: "#922b22"
        },
        background: "#0d2b27",
        foreground: "#e8f5f2",
        card: "#1a3d38",
        muted: "#8fbfb8",
        border: "#2f6b62",
        primary: {
          DEFAULT: "#7fff5f",
          foreground: "#1d6610",
          50: "#f0ffe8",
          100: "#d4ffbf",
          200: "#aeff87",
          300: "#7fff5f",
          400: "#5fd944",
          500: "#44b32e",
          600: "#2a5a52",
          700: "#224843",
          800: "#1a3d38"
        },
        input: "#2f6b62",
        ring: "#7fff5f",
        "muted-foreground": "#8fbfb8"
      }
    }
  },
  plugins: []
};

export default config;
