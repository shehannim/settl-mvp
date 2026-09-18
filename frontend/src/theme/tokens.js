/**
 * Settl Design System Tokens
 * Sourced from Stitch Project 12860544196208032886 (Modern Financial Inclusion)
 */

export const tokens = {
  colors: {
    primary: {
      DEFAULT: "#004fc5",
      hover: "#0043a8",
      dark: "#003a94",
      container: "#004fc5",
      onPrimary: "#ffffff",
      onContainer: "#bdcdff",
      fixed: "#dae2ff",
      fixedDim: "#b2c5ff",
    },
    secondary: {
      DEFAULT: "#006a61",
      teal: "#0d9488",
      container: "#86f2e4",
      onSecondary: "#ffffff",
      onContainer: "#006f66",
      fixed: "#89f5e7",
      fixedDim: "#6bd8cb",
    },
    tertiary: {
      DEFAULT: "#5c3800",
      amber: "#f59e0b",
      container: "#7c4d00",
      onTertiary: "#ffffff",
      onContainer: "#ffc278",
      fixed: "#ffddb8",
      fixedDim: "#ffb95f",
    },
    error: {
      DEFAULT: "#ba1a1a",
      crimson: "#dc2626",
      container: "#ffdad6",
      onError: "#ffffff",
      onContainer: "#93000a",
    },
    surfaces: {
      canvas: "#fafafc",
      surface: "#f8f9ff",
      surfaceDim: "#ccdbf3",
      surfaceBright: "#f8f9ff",
      card: "#ffffff",
      low: "#eff4ff",
      container: "#e6eeff",
      high: "#dce9ff",
      highest: "#d5e3fc",
    },
    neutrals: {
      onSurface: "#0d1c2e",
      onSurfaceVariant: "#434654",
      outline: "#737685",
      outlineVariant: "#c3c6d6",
      borderHairline: "#e2e8f0",
      textPrimary: "#0f172a",
      textSecondary: "#475569",
      textMuted: "#94a3b8",
    },
  },
  typography: {
    fontFamilies: {
      sans: ["Plus Jakarta Sans", "sans-serif"],
      mono: ["Geist Mono", "Space Mono", "monospace"],
    },
    styles: {
      displayHero: {
        fontSize: "44px",
        fontWeight: "800",
        lineHeight: "52px",
        letterSpacing: "-0.03em",
      },
      headlineLg: {
        fontSize: "32px",
        fontWeight: "700",
        lineHeight: "38px",
        letterSpacing: "-0.02em",
      },
      headlineMd: {
        fontSize: "22px",
        fontWeight: "600",
        lineHeight: "28px",
        letterSpacing: "-0.015em",
      },
      headlineSm: {
        fontSize: "18px",
        fontWeight: "600",
        lineHeight: "24px",
        letterSpacing: "-0.01em",
      },
      bodyLg: {
        fontSize: "16px",
        fontWeight: "400",
        lineHeight: "24px",
        letterSpacing: "-0.005em",
      },
      bodyMd: {
        fontSize: "14px",
        fontWeight: "400",
        lineHeight: "20px",
        letterSpacing: "0em",
      },
      bodySm: {
        fontSize: "12px",
        fontWeight: "400",
        lineHeight: "16px",
        letterSpacing: "0.01em",
      },
      labelLg: {
        fontSize: "14px",
        fontWeight: "600",
        lineHeight: "20px",
        letterSpacing: "-0.005em",
      },
      labelMd: {
        fontSize: "12px",
        fontWeight: "600",
        lineHeight: "16px",
        letterSpacing: "0.02em",
      },
      labelSm: {
        fontSize: "11px",
        fontWeight: "600",
        lineHeight: "14px",
        letterSpacing: "0.04em",
      },
      numericScore: {
        fontSize: "48px",
        fontWeight: "700",
        lineHeight: "52px",
        letterSpacing: "-0.04em",
      },
      numericData: {
        fontSize: "15px",
        fontWeight: "500",
        lineHeight: "20px",
        letterSpacing: "-0.01em",
      },
    },
  },
  radii: {
    sm: "0.25rem",
    DEFAULT: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    full: "9999px",
  },
  shadows: {
    level0: "none",
    level1: "0px 1px 3px rgba(15, 23, 42, 0.04), 0px 6px 16px rgba(15, 23, 42, 0.02)",
    level2: "0px 8px 24px -4px rgba(0, 79, 197, 0.08), 0px 4px 12px -2px rgba(15, 23, 42, 0.05)",
    level3: "0px 20px 40px -8px rgba(15, 23, 42, 0.16)",
  },
};

export default tokens;
