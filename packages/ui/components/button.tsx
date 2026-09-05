import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { controls, radius, spacing, typography, type ThemeColors } from "../theme";

// The one button (design: primary is accent with on-accent text, secondary
// is surface with text color, height 48, radius 12). Labels never wrap;
// a long label shrinks a little instead of overflowing.

export type ButtonVariant = "primary" | "secondary" | "destructive" | "warning";

export function Button({
  label,
  onPress,
  colors,
  variant = "primary",
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  variant?: ButtonVariant;
  disabled?: boolean;
  // layout only (flex in a row, margins); colors and sizing stay unified
  style?: StyleProp<ViewStyle>;
}) {
  const labelColor =
    variant === "primary"
      ? colors.onAccent
      : variant === "destructive"
        ? colors.statusNotWorking
        : variant === "warning"
          ? colors.statusPartiallyWorking
          : colors.textPrimary;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:
            variant === "primary"
              ? pressed
                ? colors.accentPressed
                : colors.accent
              : pressed
                ? colors.surface2
                : colors.surface,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.label, { color: labelColor }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: controls.buttonHeight,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
});
