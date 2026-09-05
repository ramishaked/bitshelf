import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { defaultLanguage, initI18n } from "@bitshelf/i18n";
import { clerkEnabled, GuestProvider } from "../lib/auth";
import { useThemeColors } from "../lib/theme";

initI18n(defaultLanguage);

// RTL is applied natively before JS runs, via extra.supportsRTL and
// extra.forcesRTL in app.json (expo-localization). No runtime flip: calling
// I18nManager.forceRTL plus reload at startup breaks the Expo Go runtime.
// Language switching (spec 12) will revisit forcesRTL when English arrives.

export default function RootLayout() {
  const colors = useThemeColors();

  const app = (
    <GuestProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="item/new"
          options={{ presentation: "modal", headerShown: true }}
        />
        <Stack.Screen name="item/[id]" options={{ headerShown: true }} />
      </Stack>
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
