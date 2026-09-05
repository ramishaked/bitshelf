import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import he from "./locales/he.json";

export type AppLanguage = "he" | "en";

// Hebrew first, English is a real translation and not a placeholder (spec 12)
export const resources = {
  he: { translation: he },
  en: { translation: en },
} as const;

export const defaultLanguage: AppLanguage = "he";

// RTL follows the app language, not the device language (spec 12)
export function isRTL(language: string): boolean {
  return language === "he";
}

export function initI18n(language: AppLanguage = defaultLanguage) {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: defaultLanguage,
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}

export default i18n;
