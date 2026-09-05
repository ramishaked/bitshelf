import { StyleSheet, Text, View } from "react-native";
import { spacing, type ThemeColors } from "../theme";
import { LogoPlaceholder } from "./logo-placeholder";

interface EmptyStateProps {
  title: string;
  hint?: string;
  colors: ThemeColors;
  showLogo?: boolean;
}

export function EmptyState({ title, hint, colors, showLogo = false }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {showLogo ? <LogoPlaceholder /> : null}
      <Text style={[styles.title, { color: colors.textPrimary }, showLogo && styles.afterLogo]}>
        {title}
      </Text>
      {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  afterLogo: {
    marginTop: spacing.xl,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 14,
    textAlign: "center",
  },
});
