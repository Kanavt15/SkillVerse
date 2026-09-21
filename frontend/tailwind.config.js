/** @type {import('tailwindcss').Config} */

/**
 * SkillVerse — Graphite & Signal
 *
 * Every colour resolves to a CSS variable from index.css, so themes are
 * switched in one place and `dark:` never has to be written by hand.
 *
 * The previous config hardcoded blue hex ramps for `cobalt`, `violet`,
 * `indigo` and `cyan`. Those silently overrode the semantic tokens wherever a
 * page used `text-violet-500`, which is how "violet" ended up rendering blue.
 * The legacy names are kept as aliases so existing pages keep working, but they
 * now point at real tokens.
 */
export default {
  darkMode: ["selector", "[data-theme='dark']"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: {
          DEFAULT: "hsl(var(--background))",
          alt: "hsl(var(--background-alt))",
        },
        foreground: "hsl(var(--foreground))",

        surface: {
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
          raised: "hsl(var(--surface-raised))",
        },

        /* PRACTICE — the signal colour. */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          light: "hsl(var(--primary-light))",
          foreground: "hsl(var(--primary-foreground))",
        },

        /* PROGRESS — XP, streaks, levels, credits. */
        amber: {
          DEFAULT: "hsl(var(--amber))",
          soft: "hsl(var(--amber-soft))",
        },

        /* TEACHING — the earned tier. */
        violet: {
          DEFAULT: "hsl(var(--violet))",
          soft: "hsl(var(--violet-soft))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--primary-foreground))",
        },
        emerald: { DEFAULT: "hsl(var(--emerald))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--surface-2))",
          foreground: "hsl(var(--foreground))",
        },

        /* Legacy aliases — remapped, not removed. */
        cobalt: { DEFAULT: "hsl(var(--primary))", muted: "hsl(var(--primary-light))" },
        teal:   { DEFAULT: "hsl(var(--accent))",  muted: "hsl(var(--accent))" },
        cyan:   { DEFAULT: "hsl(var(--accent))" },
        indigo: { DEFAULT: "hsl(var(--violet))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 16px)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        signal: "var(--shadow-signal)",
        "signal-lg": "var(--shadow-signal-lg)",
        /* legacy */
        teal: "var(--shadow-signal)",
        violet: "var(--shadow-signal)",
        cobalt: "var(--shadow-signal)",
      },
      keyframes: {
        "accordion-down": { from: { height: 0 }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: 0 } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-6px)" } },
        "float-delayed": { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-4px)" } },
        "fade-in-up": { "0%": { opacity: 0, transform: "translateY(12px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "slide-in-right": { "0%": { opacity: 0, transform: "translateX(16px)" }, "100%": { opacity: 1, transform: "translateX(0)" } },
        "scale-in": { "0%": { opacity: 0, transform: "scale(0.97)" }, "100%": { opacity: 1, transform: "scale(1)" } },
        "pulse-slow": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.55 } },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        /* Ticks a stat up when it changes, so progress is felt. */
        "count-pop": { "0%": { transform: "scale(1)" }, "45%": { transform: "scale(1.08)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.6s infinite",
        float: "float 7s ease-in-out infinite",
        "float-delayed": "float-delayed 9s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scale-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "count-pop": "count-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
}
