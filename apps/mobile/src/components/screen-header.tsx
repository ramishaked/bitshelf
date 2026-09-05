import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, typography } from "@bitshelf/ui";
import { useThemeColors } from "../lib/theme";

// Large title aligned to the reading start (right in Hebrew), like the
// approved design. Replaces the centered native navigation header.
export function ScreenHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + spacing.sm, backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.largeTitle,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "left",
  },
});
