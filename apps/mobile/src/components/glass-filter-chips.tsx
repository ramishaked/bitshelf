import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { photoOverlay, radius, spacing, typography } from "@bitshelf/ui";
import {
  categoriesOf,
  decadesOf,
  emptyFilters,
  hasActiveFilters,
  manufacturersOf,
  type ItemFilters,
} from "../lib/filters";
import { categories as seedCategories } from "../lib/retro";
import type { LocalItem } from "../lib/store";
import { useThemeName } from "../lib/theme";

// Filter capsules floating over the photo wall (handoff G01): the active
// chip flips to near solid white with dark ink, the rest are glass. The
// leading chip is "all N" and clears every filter.

const WORKING_STATUSES = ["working", "partially_working", "not_working", "untested"];

function Chip({
  label,
  active,
  latin,
  themeName,
  onPress,
}: {
  label: string;
  active: boolean;
  latin?: boolean;
  themeName: "dark" | "light";
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: photoOverlay.chipActiveBg }
          : { borderWidth: StyleSheet.hairlineWidth, borderColor: photoOverlay.glassBorder },
      ]}
    >
      {!active ? (
        <BlurView
          tint={themeName === "dark" ? "dark" : "light"}
          intensity={40}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          { color: active ? photoOverlay.chipActiveText : photoOverlay.text },
          active && styles.activeLabel,
          latin && styles.latin,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GlassFilterChips({
  items,
  totalCount,
  filters,
  onChange,
}: {
  items: LocalItem[];
  totalCount: number;
  filters: ItemFilters;
  onChange: (next: ItemFilters) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const themeName = useThemeName();

  const categoryLabel = (slug: string) =>
    seedCategories.find((c) => c.slug === slug)?.name[lang] ?? slug;

  const toggle = <K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) =>
    onChange({ ...filters, [key]: filters[key] === value ? null : value });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Chip
        label={`${t("filters.all")} ${totalCount}`}
        active={!hasActiveFilters(filters)}
        themeName={themeName}
        onPress={() => onChange({ ...emptyFilters, query: filters.query })}
      />
      <Chip
        label={t("filters.favorites")}
        active={filters.favoritesOnly}
        themeName={themeName}
        onPress={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
      />
      <Chip
        label={t("item.toComplete")}
        active={filters.toCompleteOnly}
        themeName={themeName}
        onPress={() => onChange({ ...filters, toCompleteOnly: !filters.toCompleteOnly })}
      />
      {WORKING_STATUSES.map((status) => (
        <Chip
          key={status}
          label={t(`status.${status}`)}
          active={filters.workingStatus === status}
          themeName={themeName}
          onPress={() => toggle("workingStatus", status)}
        />
      ))}
      {categoriesOf(items).map((slug) => (
        <Chip
          key={slug}
          label={categoryLabel(slug)}
          active={filters.category === slug}
          themeName={themeName}
          onPress={() => toggle("category", slug)}
        />
      ))}
      {manufacturersOf(items).map((name) => (
        <Chip
          key={name}
          label={name}
          latin
          active={filters.manufacturer === name}
          themeName={themeName}
          onPress={() => toggle("manufacturer", name)}
        />
      ))}
      {decadesOf(items).map((decade) => (
        <Chip
          key={decade}
          label={`${decade}s`}
          latin
          active={filters.decade === decade}
          themeName={themeName}
          onPress={() => toggle("decade", decade)}
        />
      ))}
      <View style={styles.tail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg + spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md + 2,
    height: 32,
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    fontSize: 13,
  },
  activeLabel: {
    fontWeight: "600",
  },
  latin: {
    writingDirection: "ltr",
  },
  tail: {
    width: spacing.sm,
  },
});
