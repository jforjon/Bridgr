import type { Config } from "tailwindcss";

/*
 * Bridgr design system — "Studio · lime · Bricolage + DM Sans".
 *
 * Colour is two layers. Numbered palettes (grey/lime/danger/success/warning)
 * live in globals.css and are never referenced from a component. Semantic
 * aliases carry the same names in both modes and point at different palette
 * steps, so a component is written once and themed by swapping the alias map.
 *
 * Everything below is an alias onto a CSS custom property. Never a raw hex.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        /* Canvas + surfaces. Depth comes from surface steps, not shadow. */
        app: "var(--bg)",
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface-1)",
          "1": "var(--surface-1)",
          "2": "var(--surface-2)",
          "3": "var(--surface-3)"
        },
        /* Legacy alias — `card` is `surface-1`, `card-2` is `surface-2`. */
        card: {
          DEFAULT: "var(--surface-1)",
          "2": "var(--surface-2)",
          "3": "var(--surface-3)"
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)"
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)"
        },
        /* Text. `ink` is the legacy name for the same three steps. */
        ink: {
          DEFAULT: "var(--text-1)",
          secondary: "var(--text-2)",
          tertiary: "var(--text-3)",
          disabled: "var(--text-disabled)"
        },
        text: {
          "1": "var(--text-1)",
          "2": "var(--text-2)",
          "3": "var(--text-3)",
          disabled: "var(--text-disabled)"
        },
        muted: "var(--text-2)",
        /* Lime is a fill, never type. Lime type/hairlines use `accent-text`. */
        accent: {
          DEFAULT: "var(--accent-text)",
          text: "var(--accent-text)",
          fill: "var(--accent-fill)",
          hover: "var(--accent-fill-hover)",
          active: "var(--accent-fill-active)",
          pressed: "var(--accent-fill-active)",
          "on-fill": "var(--accent-on-fill)",
          ink: "var(--accent-on-fill)",
          graph: "var(--accent-graph)",
          subtle: "var(--accent-subtle)",
          soft: "var(--accent-subtle)"
        },
        danger: {
          DEFAULT: "var(--danger)",
          hover: "var(--danger-hover)",
          active: "var(--danger-active)",
          subtle: "var(--danger-subtle)",
          soft: "var(--danger-subtle)",
          "on-subtle": "var(--danger-on-subtle)",
          solid: "var(--danger-solid)"
        },
        success: {
          DEFAULT: "var(--success)",
          hover: "var(--success-hover)",
          active: "var(--success-active)",
          subtle: "var(--success-subtle)",
          soft: "var(--success-subtle)",
          "on-subtle": "var(--success-on-subtle)"
        },
        warning: {
          DEFAULT: "var(--warning)",
          hover: "var(--warning-hover)",
          active: "var(--warning-active)",
          subtle: "var(--warning-subtle)",
          soft: "var(--warning-subtle)",
          "on-subtle": "var(--warning-on-subtle)"
        },
        scrim: "var(--scrim)"
      },
      fontFamily: {
        /* All interface text and all native-language copy. */
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        /* Only where the content is the language itself, and never below 20px. */
        display: ["Bricolage Grotesque", "ui-sans-serif", "system-ui", "sans-serif"],
        /* Legacy alias — `font-serif` now resolves to the display face. */
        serif: ["Bricolage Grotesque", "ui-sans-serif", "system-ui", "sans-serif"],
        /* Only the small-caps label class. Never a sentence. */
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      fontSize: {
        /* Sizes step 4 → 8px; every line-height is a multiple of 8. */
        "display-1": ["48px", { lineHeight: "56px", letterSpacing: "-0.03em" }],
        "display-2": ["32px", { lineHeight: "40px", letterSpacing: "-0.03em" }],
        "title-1": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
        "title-2": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        "title-3": ["20px", { lineHeight: "28px", letterSpacing: "-0.015em" }],
        "body-lg": ["18px", { lineHeight: "24px" }],
        body: ["16px", { lineHeight: "24px" }],
        caption: ["14px", { lineHeight: "20px" }],
        "label-caps": ["12px", { lineHeight: "16px", letterSpacing: "0.16em" }]
      },
      boxShadow: {
        /* Modals only — the one element that sits over a scrim. */
        pop: "var(--shadow-pop)",
        /* Legacy key. The system is flat; this resolves to `none`. */
        accent: "var(--shadow-accent)"
      },
      /* 8 badges and inline marks · 16 controls and fields · 24 surfaces and
         sheets · full for pills, chips and every button. */
      borderRadius: {
        badge: "8px",
        control: "16px",
        surface: "24px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "24px",
        "2xl": "24px",
        "3xl": "24px",
        pill: "9999px"
      },
      spacing: {
        /* Control heights: 32 / 40 / 48 / 56. */
        control: "48px",
        "control-sm": "40px",
        "control-xs": "32px",
        field: "56px",
        page: "24px"
      },
      letterSpacing: {
        display: "-0.03em",
        title: "-0.02em",
        "title-3": "-0.015em",
        tight: "-0.03em",
        tighter: "-0.03em",
        label: "0.16em",
        caption: "0.14em"
      },
      transitionDuration: {
        1: "120ms",
        2: "200ms",
        3: "320ms"
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.2,.7,.3,1)",
        "in-out": "cubic-bezier(.5,0,.3,1)",
        spring: "cubic-bezier(.3,1.3,.5,1)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        /* Legacy name, same motion. */
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        rise: "rise 200ms cubic-bezier(.2,.7,.3,1) forwards",
        "slide-up": "rise 200ms cubic-bezier(.2,.7,.3,1) forwards"
      }
    }
  },
  plugins: []
};

export default config;
