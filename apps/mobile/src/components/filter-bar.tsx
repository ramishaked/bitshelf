import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { radius, spacing, typography } from "@bitshelf/ui";
import {
  categoriesOf,
  decadesOf,
  manufacturersOf,
  type ItemFilters,
} from "../lib/filters";
import { categories as seedCategories } from "../lib/retro";
import type { LocalItem } from "../lib/store";
import { useThemeColors } from "../lib/theme";

const WORKING_STATUSES = ["working", "partially_working", "not_working", "untested"];

function Chip({
  label,
  active,
  latin,
  onPress,
}: {
  label: string;
  active: boolean;
  latin?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.accentPressed : colors.surface },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? colors.onAccent : colors.textPrimary },
          latin && styles.latin,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Search row plus one horizontal chip bar (spec 7.1). Chip values are drawn
// from the items themselves, one active value per dimension.
export function FilterBar({
  items,
  filters,
  onChange,
}: {
  items: LocalItem[];
  filters: ItemFilters;
  onChange: (next: ItemFilters) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();

  const categoryLabel = (slug: string) =>
    seedCategories.find((c) => c.slug === slug)?.name[lang] ?? slug;

  const toggle = <K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) =>
    onChange({ ...filters, [key]: filters[key] === value ? null : value });

  return (
    <View style={styles.wrap}>
      <TextInput
        value={filters.query}
        onChangeText={(query) => onChange({ ...filters, query })}
        placeholder={t("filters.searchPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        clearButtonMode="while-editing"
        autoCorrect={false}
        style={[
          styles.search,
          { backgroundColor: colors.surface, color: colors.textPrimary },
        ]}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t("filters.favorites")}
          active={filters.favoritesOnly}
          onPress={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
        />
        <Chip
          label={t("item.toComplete")}
          active={filters.toCompleteOnly}
          onPress={() =>
            onChange({ ...filters, toCompleteOnly: !filters.toCompleteOnly })
          }
        />
        <Chip
          label={t("item.isPrivate")}
          active={filters.privateOnly}
          onPress={() => onChange({ ...filters, privateOnly: !filters.privateOnly })}
        />
        {WORKING_STATUSES.map((status) => (
          <Chip
            key={status}
            label={t(`status.${status}`)}
            active={filters.workingStatus === status}
            onPress={() => toggle("workingStatus", status)}
          />
        ))}
        {categoriesOf(items).map((slug) => (
          <Chip
            key={slug}
            label={categoryLabel(slug)}
            active={filters.category === slug}
            onPress={() => toggle("category", slug)}
          />
        ))}
        {manufacturersOf(items).map((name) => (
          <Chip
            key={name}
            label={name}
            latin
            active={filters.manufacturer === name}
            onPress={() => toggle("manufacturer", name)}
          />
        ))}
        {decadesOf(items).map((decade) => (
          <Chip
            key={decade}
            label={`${decade}s`}
            latin
            active={filters.decade === decade}
            onPress={() => toggle("decade", decade)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  search: {
    marginHorizontal: spacing.lg + spacing.xs,
    height: 38,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.secondary + 1,
    // logical start, physical right in RTL, like the rest of the forms
    textAlign: "left",
  },
  chips: {
    paddingHorizontal: spacing.lg + spacing.xs,
    gap: spacing.sm - 2,
  },
  chip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    height: 30,
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 13,
  },
  latin: {
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
});
