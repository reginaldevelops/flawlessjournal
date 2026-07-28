const plugin = require("tailwindcss/plugin");

/** Semantic color that reads from a CSS custom property holding an RGB triplet. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        "canvas-inset": token("canvas-inset"),
        surface: {
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
          overlay: token("surface-overlay"),
          sunken: token("surface-sunken"),
          hover: token("surface-hover"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
          subtle: token("line-subtle"),
        },
        content: {
          DEFAULT: token("content"),
          muted: token("content-muted"),
          subtle: token("content-subtle"),
          inverse: token("content-inverse"),
        },
        brand: {
          DEFAULT: token("brand"),
          hover: token("brand-hover"),
          soft: token("brand-soft"),
          fg: token("brand-fg"),
        },
        profit: {
          DEFAULT: token("profit"),
          soft: token("profit-soft"),
          fg: token("profit-fg"),
        },
        loss: {
          DEFAULT: token("loss"),
          soft: token("loss-soft"),
          fg: token("loss-fg"),
        },
        warn: {
          DEFAULT: token("warn"),
          soft: token("warn-soft"),
          fg: token("warn-fg"),
        },
        info: {
          DEFAULT: token("info"),
          soft: token("info-soft"),
          fg: token("info-fg"),
        },
        neutralish: {
          DEFAULT: token("neutralish"),
          soft: token("neutralish-soft"),
        },
        focus: token("focus"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.875rem", { lineHeight: "1.375rem" }],
        md: ["0.9375rem", { lineHeight: "1.5rem" }],
        lg: ["1.0625rem", { lineHeight: "1.625rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.011em" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.018em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.021em" }],
        "4xl": ["2.375rem", { lineHeight: "2.75rem", letterSpacing: "-0.024em" }],
        "5xl": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.028em" }],
        stat: ["1.75rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
        "stat-lg": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.024em" }],
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        pop: "var(--shadow-pop)",
        glow: "var(--shadow-glow)",
        "inner-line": "inset 0 1px 0 0 rgb(var(--line-subtle))",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-accent)) 100%)",
        "profit-gradient":
          "linear-gradient(180deg, rgb(var(--profit) / 0.28) 0%, rgb(var(--profit) / 0) 100%)",
        "loss-gradient":
          "linear-gradient(180deg, rgb(var(--loss) / 0.28) 0%, rgb(var(--loss) / 0) 100%)",
        "grid-fade":
          "radial-gradient(ellipse at top, rgb(var(--brand) / 0.10), transparent 60%)",
        "sheen":
          "linear-gradient(110deg, transparent 25%, rgb(255 255 255 / 0.16) 50%, transparent 75%)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--brand) / 0.5)" },
          "70%": { boxShadow: "0 0 0 8px rgb(var(--brand) / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--brand) / 0)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
        "fade-in-up": "fade-in-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-scale": "fade-in-scale 0.18s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-up": "slide-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "count-up": "count-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        marquee: "marquee 40s linear infinite",
      },
      spacing: {
        "sidebar": "var(--sidebar-w)",
        "sidebar-collapsed": "var(--sidebar-w-collapsed)",
        "topbar": "var(--topbar-h)",
      },
      zIndex: {
        header: "40",
        sidebar: "45",
        overlay: "60",
        modal: "70",
        popover: "80",
        toast: "90",
      },
      maxWidth: {
        page: "96rem",
        prose: "44rem",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    plugin(function ({ addUtilities, addVariant }) {
      addVariant("hocus", ["&:hover", "&:focus-visible"]);
      addUtilities({
        ".no-scrollbar": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
        ".thin-scrollbar": {
          "scrollbar-width": "thin",
          "scrollbar-color": "rgb(var(--line-strong)) transparent",
          "&::-webkit-scrollbar": { width: "8px", height: "8px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "rgb(var(--line-strong))",
            borderRadius: "9999px",
            border: "2px solid transparent",
            backgroundClip: "content-box",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgb(var(--content-subtle))",
            backgroundClip: "content-box",
          },
        },
        ".tnum": { "font-variant-numeric": "tabular-nums" },
        ".text-balance": { "text-wrap": "balance" },
        ".text-pretty": { "text-wrap": "pretty" },
        ".card-surface": {
          background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--line))",
          borderRadius: "0.75rem",
        },
      });
    }),
  ],
};
