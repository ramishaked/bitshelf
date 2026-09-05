// Source of truth for all colors and visual tokens (spec 15.3, 15.4).
// No hex values anywhere else in the repo.

export interface ThemeColors {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentPressed: string;
  statusWorking: string;
  statusPartiallyWorking: string;
  statusNotWorking: string;
  statusUntested: string;
}

export const darkColors: ThemeColors = {
  background: "#0E0F0D",
  surface: "#1A1C18",
  textPrimary: "#EDEFE8",
  textSecondary: "#9AA096",
  // phosphor green, dimmed from the logo green so text does not burn
  accent: "#5CE65C",
  // pressed states and active chip backgrounds
  accentPressed: "#2E8F2E",
  statusWorking: "#5CE65C",
  statusPartiallyWorking: "#F5A524",
  statusNotWorking: "#E0563F",
  statusUntested: "#7A7F76",
};

export const lightColors: ThemeColors = {
  background: "#F4F5F1",
  surface: "#FFFFFF",
  textPrimary: "#161815",
  // not in spec 15.3, derived to keep contrast on the light background
  textSecondary: "#6A6F66",
  // darker green, phosphor is unreadable on white
  accent: "#1E9E3A",
  // not in spec 15.3, derived from the light accent
  accentPressed: "#16702A",
  statusWorking: "#5CE65C",
  statusPartiallyWorking: "#F5A524",
  statusNotWorking: "#E0563F",
  statusUntested: "#7A7F76",
};

// Logo and splash only (spec 15.1). Never in regular UI.
export const brand = {
  logoGreen: "#3DF23D",
  splashBackground: "#0B0B0A",
};

export type ThemeName = "dark" | "light";

export const themes: Record<ThemeName, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};

// 12px corners, no shadows, separation by tone and not by lines (spec 15.4)
export const radius = {
  card: 12,
};

// 2px gap so photos build a wall (spec 15.4)
export const grid = {
  gap: 2,
};

export const typography = {
  // SF Pro / SF Hebrew are the iOS system defaults, no font loading needed
  sans: "System",
  // spec 15.4 calls for SF Mono (serials, years, prices only). SF Mono is not
  // available to apps without bundling the font, Menlo stands in until then.
  mono: "Menlo",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
