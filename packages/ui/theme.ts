// Source of truth for all colors and visual tokens.
// Approved in the Claude Design project "BitShelf", see docs/design/DESIGN.md
// (spec 15.5: after approval the tokens land here and this file wins).
// No hex values anywhere else in the repo.

export interface ThemeColors {
  background: string;
  surface: string;
  // pressed states and nested surfaces
  surface2: string;
  textPrimary: string;
  textSecondary: string;
  // dividers, use sparingly: separation is by tone, not by lines
  line: string;
  accent: string;
  // pressed accent, active chip background
  accentPressed: string;
  // text on accent buttons
  onAccent: string;
  // floating add button shadow
  glow: string;
  statusWorking: string;
  statusPartiallyWorking: string;
  statusNotWorking: string;
  statusUntested: string;
}

export const darkColors: ThemeColors = {
  background: "#0E0F0D",
  surface: "#1A1C18",
  surface2: "#23261F",
  textPrimary: "#EDEFE8",
  textSecondary: "#9AA096",
  line: "#2A2D27",
  // phosphor green, dimmed from the logo green so text does not burn
  accent: "#5CE65C",
  accentPressed: "#2E8F2E",
  onAccent: "#0E0F0D",
  glow: "rgba(92,230,92,0.35)",
  statusWorking: "#5CE65C",
  statusPartiallyWorking: "#F5A524",
  statusNotWorking: "#E0563F",
  statusUntested: "#7A7F76",
};

export const lightColors: ThemeColors = {
  background: "#F4F5F1",
  surface: "#FFFFFF",
  surface2: "#ECEEE8",
  textPrimary: "#161815",
  textSecondary: "#6B7066",
  line: "#DDE0D8",
  // darker green, phosphor is unreadable on white
  accent: "#1E9E3A",
  accentPressed: "#167A2C",
  onAccent: "#FFFFFF",
  glow: "rgba(30,158,58,0.3)",
  statusWorking: "#1E9E3A",
  statusPartiallyWorking: "#D98C0E",
  statusNotWorking: "#C7432E",
  statusUntested: "#8A8F86",
};

// Logo and splash only (spec 15.1). Never in regular UI.
export const brand = {
  logoGreen: "#3DF23D",
  splashBackground: "#0B0B0A",
};

// Text over photos is theme independent: white on the tile's bottom gradient,
// the only allowed gradient (design "Do not" list)
export const photoOverlay = {
  text: "#FFFFFF",
  gradientStart: "transparent",
  gradientEnd: "rgba(0,0,0,0.75)",
  // full-screen photo viewer is black in both themes
  viewerBackground: "#000000",
  viewerControl: "rgba(0,0,0,0.45)",
};

export type ThemeName = "dark" | "light";

export const themes: Record<ThemeName, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};

// 12 on cards and buttons, 8 on tags, 999 on chips. No shadows.
export const radius = {
  card: 12,
  tag: 8,
  chip: 999,
};

// 3 columns, 2px gap, square tiles, so photos build a wall
export const grid = {
  gap: 2,
  columns: 3,
};

export const typography = {
  // SF Pro / SF Hebrew are the iOS system defaults, no font loading needed
  sans: "System",
  // spec 15.4 calls for SF Mono (serials, years, prices only). SF Mono is not
  // available to apps without bundling the font, Menlo stands in until then.
  mono: "Menlo",
  sizes: {
    largeTitle: 28,
    title: 22,
    body: 16,
    secondary: 14,
    caption: 12,
  },
  lineHeight: 1.3,
};

// primary: accent background, onAccent text. secondary: surface background.
export const controls = {
  buttonHeight: 48,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
