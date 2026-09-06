import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { photoOverlay, radius, spacing } from "@bitshelf/ui";
import { clerkEnabled } from "../lib/auth";
import { shelfScanEnabled } from "../lib/flags";
import { useThemeColors, useThemeName } from "../lib/theme";

// Bottom row per the liquid glass handoff (G01): a green glass add button
// beside a glass tab capsule that fills the rest of the row. The add menu
// (spec 7.1) lives here so it is one tap from every tab.

// room tab screens leave so content clears the floating row
export const GLASS_TAB_BAR_INSET = 112;

const ICONS: Record<string, SFSymbol> = {
  index: "square.grid.2x2",
  galleries: "photo.on.rectangle",
  favorites: "heart",
  profile: "person.crop.circle",
};

// structural subset of BottomTabBarProps, so the exact @react-navigation
// version bundled by expo-router does not matter
export interface GlassTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

export function GlassTabBar({ state, descriptors, navigation }: GlassTabBarProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const themeName = useThemeName();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openAddMenu = () => {
    // spec 7.1: photograph / shelf scan / manual / wishlist
    if (!clerkEnabled) {
      router.push("/item/new");
      return;
    }
    Alert.alert(t("item.newTitle"), "", [
      { text: t("fab.capture"), onPress: () => router.push("/capture") },
      ...(shelfScanEnabled
        ? [
            {
              text: `${t("fab.shelfScan")} (Beta)`,
              onPress: () => router.push("/shelf-scan"),
            },
          ]
        : []),
      { text: t("fab.manual"), onPress: () => router.push("/item/new") },
      { text: t("fab.wishlist"), onPress: () => router.push("/wishlist") },
      { text: t("item.cancel"), style: "cancel" },
    ]);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.row, { bottom: Math.max(insets.bottom, spacing.md) + 6 }]}
    >
      <Pressable
        onPress={openAddMenu}
        style={[styles.fab, { borderColor: colors.accentSoft, shadowColor: colors.accent }]}
      >
        <BlurView
          tint={themeName === "dark" ? "dark" : "light"}
          intensity={70}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accentSoft }]} />
        <SymbolView name="plus" size={24} tintColor={colors.accent} />
      </Pressable>

      <View style={[styles.capsule, { borderColor: photoOverlay.glassBorder }]}>
        <BlurView
          tint={themeName === "dark" ? "dark" : "light"}
          intensity={80}
          style={StyleSheet.absoluteFill}
        />
        {state.routes.map((route, index) => {
          const label = descriptors[route.key]?.options.title ?? route.name;
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tab}
            >
              <SymbolView
                name={ICONS[route.name] ?? "circle"}
                size={21}
                tintColor={active ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.accent : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  capsule: {
    flex: 1,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
});
