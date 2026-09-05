import { useEffect } from "react";
import { I18nManager } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { defaultLanguage, initI18n, isRTL } from "@bitshelf/i18n";
import { clerkEnabled, GuestProvider } from "../lib/auth";
import { reloadApp } from "../lib/reload";
import { useThemeColors } from "../lib/theme";

initI18n(defaultLanguage);

// RTL follows the app language (spec 12). forceRTL only applies after a
// reload, so flip once and reload. On the next launch isRTL already matches.
function useForceRTL() {
  useEffect(() => {
    const wantRTL = isRTL(defaultLanguage);
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
      void reloadApp();
    }
  }, []);
}

export default function RootLayout() {
  useForceRTL();
  const colors = useThemeColors();

  const app = (
    <GuestProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </GuestProvider>
  );

  if (!clerkEnabled) {
    return app;
  }

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
      tokenCache={tokenCache}
    >
      {app}
    </ClerkProvider>
  );
}
