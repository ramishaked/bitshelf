import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { photoOverlay, radius, spacing, typography } from "@bitshelf/ui";
import { useThemeColors, useThemeName } from "../lib/theme";

// Floating action pills per the liquid glass handoff (G02): equal-width
// capsules across the bottom, the primary on a glowing accent fill and the
// rest on glass.

export interface GlassAction {
  // with an icon the pill shows only the symbol; the label becomes the
  // accessibility name (long labels crowd a 4-pill row)
  label: string;
  icon?: SFSymbol;
  onPress: () => void;
  variant?: "primary" | "plain" | "destructive" | "warning";
  // rendered dimmed and unpressable (e.g. save before a required field)
  disabled?: boolean;
}

export function GlassActionBar({
  actions,
  aboveTabBar = false,
}: {
  actions: GlassAction[];
  // inside the tab screens the pills must clear the floating tab row,
  // which sits at the same bottom offset and would cover them
  aboveTabBar?: boolean;
}) {
  const colors = useThemeColors();
  const themeName = useThemeName();
  const insets = useSafeAreaInsets();

  // the bar is pinned to the screen bottom, so an open keyboard would
  // cover it (Rami got stuck on the gallery name form); ride above it
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e) =>
      setKeyboard(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const restingBottom = aboveTabBar ? 110 : Math.max(insets.bottom, spacing.md) + 6;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.row,
        { bottom: keyboard > 0 ? keyboard + spacing.sm : restingBottom },
      ]}
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
            accessibilityLabel={action.label}
            onPress={action.disabled ? undefined : action.onPress}
            style={({ pressed }) => [
              styles.action,
              action.disabled && { opacity: 0.4 },
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
            {action.icon ? (
              <SymbolView name={action.icon} size={22} tintColor={labelColor} />
            ) : (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.label, { color: labelColor }]}
              >
                {action.label}
              </Text>
            )}
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
