import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { themes, type ThemeColors, type ThemeName } from "@bitshelf/ui";
import { getSetting, setSetting } from "./store";

// Appearance override (profile setting). "system" follows iOS; dark is the
// default whenever nothing says light (UI rules: dark is default).

export type ThemeMode = "system" | "dark" | "light";

const SETTING_KEY = "theme_mode";

function loadMode(): ThemeMode {
  const saved = getSetting(SETTING_KEY);
  return saved === "dark" || saved === "light" ? saved : "system";
}

let mode: ThemeMode = loadMode();
const listeners = new Set<() => void>();

export function setThemeMode(next: ThemeMode): void {
  mode = next;
  setSetting(SETTING_KEY, next);
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, () => mode);
}

export function useThemeName(): ThemeName {
  const system = useColorScheme();
  const current = useThemeMode();
  const scheme = current === "system" ? system : current;
  return scheme === "light" ? "light" : "dark";
}

export function useThemeColors(): ThemeColors {
  return themes[useThemeName()];
}
