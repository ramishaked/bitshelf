import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { EmptyState, spacing, typography } from "@bitshelf/ui";
import { ItemGrid } from "../../components/item-grid";
import { categories as seedCategories } from "../../lib/retro";
import { listItems, type LocalItem } from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

// Smart gallery (spec 4.5, 7.3): a filter, not a stored list. Built-in kinds
// only for now, saved custom filters come later.
export default function SmartGalleryScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const { kind, value } = useLocalSearchParams<{ kind: string; value?: string }>();
  const [items, setItems] = useState<LocalItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      const all = listItems();
      if (kind === "manufacturer" && value) {
        setItems(all.filter((i) => i.attributes.manufacturer === value));
      } else if (kind === "category" && value) {
        setItems(all.filter((i) => i.category === value));
      } else {
        // recently added, listItems is already newest first
        setItems(all.slice(0, 24));
      }
    }, [kind, value]),
  );

  const title =
    kind === "manufacturer"
      ? (value ?? "")
      : kind === "category"
        ? (seedCategories.find((c) => c.slug === value)?.name[lang] ?? value ?? "")
        : t("galleries.recentlyAdded");

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {t("gallery.itemCount", { count: items.length })}
        </Text>
        {items.length === 0 ? (
          <EmptyState title={t("filters.noResults")} colors={colors} />
        ) : (
          <ItemGrid items={items} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  count: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingVertical: spacing.sm,
  },
});
