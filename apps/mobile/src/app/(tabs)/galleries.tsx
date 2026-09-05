import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { EmptyState, radius, spacing, typography } from "@bitshelf/ui";
import { ScreenHeader } from "../../components/screen-header";
import { categoriesOf, manufacturersOf } from "../../lib/filters";
import { categories as seedCategories } from "../../lib/retro";
import {
  galleryItemCount,
  listGalleries,
  listGalleryItems,
  listItems,
  type LocalGallery,
  type LocalItem,
} from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

interface Row {
  key: string;
  title: string;
  latinTitle: boolean;
  count: number;
  coverUri: string | null;
  badge: string | null;
  onPress: () => void;
}

function coverOf(items: LocalItem[]): string | null {
  for (const item of items) {
    const photo = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
    if (photo) return photo.thumbUri;
  }
  return null;
}

function GalleryRow({ row }: { row: Row }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={row.onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surface2 : colors.surface },
      ]}
    >
      <View style={[styles.cover, { backgroundColor: colors.surface2 }]}>
        {row.coverUri ? (
          <Image source={{ uri: row.coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
      </View>
      <View style={styles.rowBody}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            { color: colors.textPrimary },
            row.latinTitle && styles.latin,
          ]}
        >
          {row.title}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
          {row.count}
          {row.badge ? `  ·  ${row.badge}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

// Gallery list (spec 7.3): the user's galleries plus smart galleries derived
// from the collection (by manufacturer, by category, recently added).
export default function GalleriesScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  const [galleries, setGalleries] = useState<LocalGallery[]>([]);
  const [items, setItems] = useState<LocalItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setGalleries(listGalleries());
      setItems(listItems());
    }, []),
  );

  const manualRows: Row[] = galleries.map((g) => ({
    key: g.id,
    title: lang === "en" && g.nameEn ? g.nameEn : g.nameHe,
    latinTitle: false,
    count: galleryItemCount(g.id),
    coverUri: coverOf(listGalleryItems(g.id)),
    badge:
      g.visibility === "public_link"
        ? t("gallery.visibilityPublic")
        : t("gallery.visibilityPrivate"),
    onPress: () => router.push(`/gallery/${g.id}`),
  }));

  const smartRows: Row[] = [];
  if (items.length > 0) {
    smartRows.push({
      key: "smart-recent",
      title: t("galleries.recentlyAdded"),
      latinTitle: false,
      count: Math.min(items.length, 24),
      coverUri: coverOf(items),
      badge: null,
      onPress: () => router.push("/gallery/smart?kind=recent"),
    });
    for (const manufacturer of manufacturersOf(items).slice(0, 6)) {
      const subset = items.filter((i) => i.attributes.manufacturer === manufacturer);
      smartRows.push({
        key: `smart-man-${manufacturer}`,
        title: manufacturer,
        latinTitle: true,
        count: subset.length,
        coverUri: coverOf(subset),
        badge: null,
        onPress: () =>
          router.push(
            `/gallery/smart?kind=manufacturer&value=${encodeURIComponent(manufacturer)}`,
          ),
      });
    }
    for (const slug of categoriesOf(items)) {
      const subset = items.filter((i) => i.category === slug);
      smartRows.push({
        key: `smart-cat-${slug}`,
        title: seedCategories.find((c) => c.slug === slug)?.name[lang] ?? slug,
        latinTitle: false,
        count: subset.length,
        coverUri: coverOf(subset),
        badge: null,
        onPress: () =>
          router.push(`/gallery/smart?kind=category&value=${encodeURIComponent(slug)}`),
      });
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("tabs.galleries")} />
      {items.length === 0 && galleries.length === 0 ? (
        <EmptyState
          title={t("galleries.emptyTitle")}
          hint={t("galleries.emptyHint")}
          colors={colors}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.section, { color: colors.textSecondary }]}>
            {t("galleries.mySection")}
          </Text>
          {manualRows.map((row) => (
            <GalleryRow key={row.key} row={row} />
          ))}
          <Pressable
            onPress={() => router.push("/gallery/new")}
            style={({ pressed }) => [
              styles.createRow,
              { backgroundColor: pressed ? colors.surface2 : colors.surface },
            ]}
          >
            <Text style={[styles.createLabel, { color: colors.accent }]}>
              {`+ ${t("galleries.create")}`}
            </Text>
          </Pressable>
          {smartRows.length > 0 ? (
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              {t("galleries.smartSection")}
            </Text>
          ) : null}
          {smartRows.map((row) => (
            <GalleryRow key={row.key} row={row} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg + spacing.xs,
    // clears the translucent tab bar the list scrolls under
    paddingBottom: spacing.xxl + 92,
    gap: spacing.sm,
  },
  section: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.card,
    padding: spacing.sm,
    gap: spacing.md,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.tag,
    overflow: "hidden",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
    textAlign: "left",
  },
  // the meta line mixes a count with Hebrew, so it stays in the UI font
  // (design: mono is for identifying numbers only, and it has no Hebrew)
  rowMeta: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
  },
  latin: {
    writingDirection: "ltr",
  },
  createRow: {
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  createLabel: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
});
