import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { photoOverlay, radius, spacing, typography } from "@bitshelf/ui";
import { useThemeColors, useThemeName } from "../lib/theme";

// Floating action pills per the liquid glass handoff (G02): equal-width
// capsules across the bottom, the primary on a glowing accent fill and the
// rest on glass.

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
      style={[styles.row, { bottom: Math.max(insets.bottom, spacing.md) + 6 }]}
    >
      {actions.map((action) => {
        const variant = action.variant ?? "plain";
        const primary = variant === "primary";
        const labelColor = primary
          ? colors.onAccent
          : variant === "destructive"
            ? colors.statusNotWorking
            : variant === "warning"
              ? colors.statusPartiallyWorking
              : colors.textPrimary;
        return (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              primary
                ? {
                    backgroundColor: pressed ? colors.accentPressed : colors.accent,
                    shadowColor: colors.accent,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                  }
                : { borderColor: photoOverlay.glassBorder, borderWidth: 1 },
            ]}
          >
            {!primary ? (
              <BlurView
                tint={themeName === "dark" ? "dark" : "light"}
                intensity={70}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.label, { color: labelColor }]}
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// room a scrolling screen leaves so content clears the floating pills
export const GLASS_ACTION_BAR_INSET = 110;

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  action: {
    flex: 1,
    height: 50,
    borderRadius: radius.chip,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
});
