import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { radius, spacing } from "@bitshelf/ui";
import { useThemeColors, useThemeName } from "../lib/theme";

// Floating glass tab capsule (Liquid Glass design, 06.09.2026): detached
// from the bottom edge, content scrolls behind it, the active tab sits on
// a soft accent pill.

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
  const colors = useThemeColors();
  const themeName = useThemeName();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.md) + 4 }]}
    >
      <View style={[styles.capsule, { borderColor: colors.line }]}>
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
              style={[
                styles.tab,
                active && { backgroundColor: colors.accentSoft },
              ]}
            >
              <SymbolView
                name={ICONS[route.name] ?? "circle"}
                size={20}
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
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  capsule: {
    flexDirection: "row",
    gap: 4,
    padding: 6,
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tab: {
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.chip,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
});
