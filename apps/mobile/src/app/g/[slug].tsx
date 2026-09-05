import { StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { spacing, typography } from "@bitshelf/ui";
import { useThemeColors } from "../../lib/theme";

// Public gallery viewer, the only route guests can reach (spec 3).
// Placeholder until galleries land in week 4.
export default function PublicGalleryScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("publicGallery.title"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={[styles.slug, { color: colors.textPrimary }]}>{slug}</Text>
        <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
          {t("publicGallery.placeholder")}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  slug: {
    fontFamily: typography.mono,
    fontSize: 18,
    // slugs are latin, LTR isolate
    writingDirection: "ltr",
  },
  placeholder: {
    fontSize: 14,
    textAlign: "center",
  },
});
