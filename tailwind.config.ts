import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          DEFAULT: "#BFFF00",
          light: "#6B8C00",
          text: "#2A3800",
          pressed: "#A8E000"
        },
        dark: {
          bg: "#1A1A1A",
          card: "#242424",
          card2: "#2E2E2E"
        },
        light: {
          bg: "#FFFFFF",
          card: "#F4F4F4",
          card2: "#EBEBEB"
        },
        danger: "#E53935",
        success: "#2E7D32",
        warning: "#F59E0B"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "18px",
        xl: "22px",
        "2xl": "28px",
        pill: "9999px"
      },
      letterSpacing: {
        tight: "-0.04em",
        tighter: "-0.03em",
        label: "0.10em",
        caption: "0.12em"
      },
      keyframes: {
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "slide-up": "slideUp 260ms ease-out forwards"
      }
    }
  },
  plugins: []
};

export default config;
