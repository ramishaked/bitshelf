import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { spacing, typography } from "@bitshelf/ui";
import { useThemeColors, useThemeName } from "../lib/theme";

// Floating glass action capsule (Liquid Glass design): the primary action
// sits on an accent pill, the rest are plain labels on the glass.

export interface GlassAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "plain" | "destructive" | "warning";
}

export function GlassActionBar({ actions }: { actions: GlassAction[] }) {
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
        {actions.map((action) => {
          const primary = (action.variant ?? "plain") === "primary";
          const labelColor = primary
            ? colors.onAccent
            : action.variant === "destructive"
              ? colors.statusNotWorking
              : action.variant === "warning"
                ? colors.statusPartiallyWorking
                : colors.textPrimary;
          return (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                primary && {
                  backgroundColor: pressed ? colors.accentPressed : colors.accent,
                },
                !primary && pressed && { backgroundColor: colors.accentSoft },
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.label, { color: labelColor }]}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// room a scrolling screen leaves so content clears the floating capsule
export const GLASS_ACTION_BAR_INSET = 110;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  capsule: {
    flexDirection: "row",
    gap: 6,
    padding: 7,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  action: {
    borderRadius: 24,
    paddingVertical: spacing.md - 1,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: typography.sizes.secondary + 1,
    fontWeight: "600",
  },
});
