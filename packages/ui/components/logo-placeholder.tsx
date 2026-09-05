import { StyleSheet, Text, View } from "react-native";
import { brand, spacing, typography } from "../theme";

// Placeholder until the vector logo lands in packages/ui/assets (spec 15.1).
// Retro styling (glow, bitmap feel) is allowed here: the logo and empty states
// are two of the three places it may appear (spec 15.2).
export function LogoPlaceholder() {
  return (
    <View style={styles.wrap}>
      <View style={styles.shelfRow}>
        <View style={[styles.block, styles.computer]} />
        <View style={[styles.block, styles.cartridge]} />
        <View style={[styles.block, styles.floppy]} />
        <View style={[styles.block, styles.book]} />
      </View>
      <View style={styles.shelf} />
      <Text style={styles.wordmark}>BitShelf</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  shelfRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  block: {
    backgroundColor: brand.logoGreen,
    opacity: 0.9,
  },
  computer: {
    width: 34,
    height: 28,
  },
  cartridge: {
    width: 22,
    height: 16,
  },
  floppy: {
    width: 20,
    height: 20,
  },
  book: {
    width: 10,
    height: 26,
  },
  shelf: {
    marginTop: spacing.xs,
    width: 132,
    height: 6,
    backgroundColor: brand.logoGreen,
  },
  wordmark: {
    marginTop: spacing.md,
    fontFamily: typography.mono,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
    color: brand.logoGreen,
    textShadowColor: brand.logoGreen,
    textShadowRadius: 12,
    // latin wordmark, keep it LTR even when the app is RTL
    writingDirection: "ltr",
  },
});
