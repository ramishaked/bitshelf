import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { EmptyState, radius, spacing, typography } from "@bitshelf/ui";
import { Dashboard } from "../../components/dashboard";
import { FilterBar } from "../../components/filter-bar";
import { ItemGrid } from "../../components/item-grid";
import { ScreenHeader } from "../../components/screen-header";
import { clerkEnabled } from "../../lib/auth";
import { shelfScanEnabled } from "../../lib/flags";
import { applyFilters, emptyFilters, hasActiveFilters } from "../../lib/filters";
import {
  listItems,
  setItemPrivate,
  toggleFavorite,
  type LocalItem,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors, useThemeName } from "../../lib/theme";

// room the content leaves for the translucent tab bar it scrolls under
const TAB_BAR_INSET = 92;

export default function CollectionScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [items, setItems] = useState<LocalItem[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  // sub tab inside the collection (spec 7.1a): gallery stays the default,
  // ?view=dashboard deep links straight to the dashboard
  const { view: viewParam } = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<"gallery" | "dashboard">(
    viewParam === "dashboard" ? "dashboard" : "gallery",
  );
  const themeName = useThemeName();
  const [headerHeight, setHeaderHeight] = useState(0);

  const reload = useCallback(() => setItems(listItems()), []);
  useFocusEffect(reload);

  const visible = useMemo(() => applyFilters(items, filters), [items, filters]);

  // long press menu (spec 7.1): favorite, private/visible, add to gallery
  const openItemActions = (item: LocalItem) => {
    Alert.alert(item.title, "", [
      {
        text: item.isFavorite
          ? t("actions.unfavorite")
          : t("actions.favorite"),
        onPress: () => {
          toggleFavorite(item.id);
          reload();
          requestSync();
        },
      },
      {
        text: item.isPrivate ? t("actions.makeVisible") : t("actions.makePrivate"),
        onPress: () => {
          setItemPrivate(item.id, !item.isPrivate);
          reload();
          requestSync();
        },
      },
      {
        text: t("actions.addToGallery"),
        onPress: () => router.push(`/gallery/pick?itemId=${item.id}`),
      },
      { text: t("item.cancel"), style: "cancel" },
    ]);
  };

  const chrome = (
    // floating translucent chrome, the content scrolls under it (Photos
    // style, Rami 05.09.2026)
    <BlurView
      tint={themeName === "dark" ? "dark" : "light"}
      intensity={80}
      onLayout={(e) => setHeaderHeight(Math.round(e.nativeEvent.layout.height))}
      style={styles.chrome}
    >
      <ScreenHeader title={t("collection.title")} transparent />
      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {(["gallery", "dashboard"] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setView(key)}
            style={[
              styles.segment,
              view === key && { backgroundColor: colors.surface2 },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: view === key ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {t(`dashboard.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {view === "gallery" ? (
        <>
          <FilterBar items={items} filters={filters} onChange={setFilters} />
          {hasActiveFilters(filters) ? (
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {t("collection.itemCount", { count: visible.length })}
            </Text>
          ) : null}
        </>
      ) : null}
    </BlurView>
  );

  return (
    <View style={styles.screen}>
      {items.length === 0 ? (
        <>
          <ScreenHeader title={t("collection.title")} />
          <EmptyState title={t("collection.emptyTitle")} colors={colors} showLogo />
        </>
      ) : (
        <>
          {view === "dashboard" ? (
            <Dashboard
              items={items}
              topInset={headerHeight}
              bottomInset={TAB_BAR_INSET}
              onFilter={(partial) => {
                setFilters({ ...emptyFilters, ...partial });
                setView("gallery");
              }}
            />
          ) : visible.length === 0 ? (
            <View style={{ flex: 1, paddingTop: headerHeight }}>
              <EmptyState title={t("filters.noResults")} colors={colors} />
            </View>
          ) : (
            <ItemGrid
              items={visible}
              onLongPressItem={openItemActions}
              topInset={headerHeight}
              bottomInset={TAB_BAR_INSET}
            />
          )}
          {chrome}
        </>
      )}
      <Pressable
        onPress={() => {
          // spec 7.1: photograph / manual add (shelf scan arrives in week 5).
          // AI capture needs a signed-in session for the server call.
          if (!clerkEnabled) {
            router.push("/item/new");
            return;
          }
          Alert.alert(t("item.newTitle"), "", [
            { text: t("fab.capture"), onPress: () => router.push("/capture") },
            // spec 6.3: experimental, Beta label, behind a feature flag
            ...(shelfScanEnabled
              ? [
                  {
                    text: `${t("fab.shelfScan")} (Beta)`,
                    onPress: () => router.push("/shelf-scan"),
                  },
                ]
              : []),
            { text: t("fab.manual"), onPress: () => router.push("/item/new") },
            // spec 7.9: fourth option, "looking for an item"
            { text: t("fab.wishlist"), onPress: () => router.push("/wishlist") },
            { text: t("item.cancel"), style: "cancel" },
          ]);
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? colors.accentPressed : colors.accent,
            shadowColor: colors.accent,
          },
        ]}
      >
        <Text style={[styles.fabPlus, { color: colors.onAccent }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  count: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingBottom: spacing.xs,
  },
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xs,
  },
  segmented: {
    flexDirection: "row",
    marginHorizontal: spacing.lg + spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.tag + 2,
    padding: 2,
  },
  segment: {
    flex: 1,
    borderRadius: radius.tag,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
  },
  segmentLabel: {
    fontSize: typography.sizes.secondary,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    end: 20,
    width: 56,
    height: 56,
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fabPlus: {
    fontSize: 30,
    fontWeight: "600",
    marginTop: -2,
  },
});
