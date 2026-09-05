import { StyleSheet, type ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import { clerkEnabled, useGuest } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";

// The collection tab is the initial route. Without this, RTL mirroring makes
// the navigator start on the last declared tab.
export const unstable_settings = {
  initialRouteName: "index",
};

function tabIcon(name: SFSymbol) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={24} />;
  };
}

function TabsNav() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tabs.collection"), tabBarIcon: tabIcon("square.grid.2x2") }}
      />
      <Tabs.Screen
        name="galleries"
        options={{ title: t("tabs.galleries"), tabBarIcon: tabIcon("photo.on.rectangle") }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: t("tabs.favorites"), tabBarIcon: tabIcon("heart") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person.crop.circle") }}
      />
    </Tabs>
  );
}

// Separate component so useAuth is only called when ClerkProvider exists
function SignedInGate() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return null;
  }
  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }
  return <TabsNav />;
}

export default function TabsLayout() {
  const { isGuest } = useGuest();
  if (isGuest) {
    return <Redirect href="/guest" />;
  }
  if (!clerkEnabled) {
    return <TabsNav />;
  }
  return <SignedInGate />;
}
