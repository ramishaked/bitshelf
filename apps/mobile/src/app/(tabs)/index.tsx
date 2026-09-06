import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { EmptyState, photoOverlay, radius, spacing, typography, type ThemeName } from "@bitshelf/ui";
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

// floating circular control on a blur pill, like the buttons in Photos
function CircleButton({
  icon,
  tint,
  themeName,
  onPress,
}: {
  icon: SFSymbol;
  tint: string;
  themeName: ThemeName;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.circle}>
      <BlurView
        tint={themeName === "dark" ? "dark" : "light"}
        intensity={70}
        style={StyleSheet.absoluteFill}
      />
      <SymbolView name={icon} size={17} tintColor={tint} />
    </Pressable>
  );
}

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
  const insets = useSafeAreaInsets();
  // search opens on demand behind the magnifier (Photos style)
  const [searchActive, setSearchActive] = useState(false);
  const [searchHeight, setSearchHeight] = useState(0);

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
    // Photos style (Rami, 06.09.2026): no chrome bar. The wall runs edge to
    // edge, a scrim keeps the floating title readable, and search lives
    // behind a magnifier button instead of a permanent field.
    searchActive && view === "gallery" ? (
      <BlurView
        tint={themeName === "dark" ? "dark" : "light"}
        intensity={80}
        onLayout={(e) => setSearchHeight(Math.round(e.nativeEvent.layout.height))}
        style={styles.searchChrome}
      >
        <View style={{ paddingTop: insets.top + spacing.xs }}>
          <View style={styles.searchTopRow}>
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {t("collection.itemCount", { count: visible.length })}
            </Text>
            <Pressable
              onPress={() => {
                setSearchActive(false);
                setFilters(emptyFilters);
              }}
            >
              <Text style={{ color: colors.accent, fontSize: typography.sizes.body }}>
                {t("item.cancel")}
              </Text>
            </Pressable>
          </View>
          <FilterBar items={items} filters={filters} onChange={setFilters} autoFocus />
        </View>
      </BlurView>
    ) : (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {view === "gallery" ? (
          <LinearGradient
            pointerEvents="none"
            colors={[photoOverlay.scrim, photoOverlay.gradientStart]}
            style={styles.scrim}
          />
        ) : null}
        <View
          pointerEvents="box-none"
          style={[styles.overlayHeader, { paddingTop: insets.top + spacing.xs }]}
        >
          <View style={styles.titleBlock}>
            <Text
              style={[
                styles.overlayTitle,
                { color: view === "gallery" ? photoOverlay.text : colors.textPrimary },
              ]}
            >
              {t("collection.title")}
            </Text>
            <Text
              style={[
                styles.overlayCount,
                { color: view === "gallery" ? photoOverlay.text : colors.textSecondary },
              ]}
            >
              {t("collection.itemCount", {
                count: view === "gallery" ? visible.length : items.length,
              })}
            </Text>
          </View>
          <View style={styles.circleGroup}>
            {view === "gallery" ? (
              <CircleButton
                icon="magnifyingglass"
                themeName={themeName}
                tint={photoOverlay.text}
                onPress={() => setSearchActive(true)}
              />
            ) : null}
            <CircleButton
              icon="chart.bar.xaxis"
              themeName={themeName}
              tint={
                view === "dashboard"
                  ? colors.accent
                  : view === "gallery"
                    ? photoOverlay.text
                    : colors.textPrimary
              }
              onPress={() => setView(view === "dashboard" ? "gallery" : "dashboard")}
            />
          </View>
        </View>
      </View>
    )
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
              topInset={insets.top + 72}
              bottomInset={TAB_BAR_INSET}
              onFilter={(partial) => {
                setFilters({ ...emptyFilters, ...partial });
                setView("gallery");
                setSearchActive(true);
              }}
            />
          ) : visible.length === 0 ? (
            <View
              style={{
                flex: 1,
                paddingTop: searchActive ? searchHeight : insets.top + 72,
              }}
            >
              <EmptyState title={t("filters.noResults")} colors={colors} />
            </View>
          ) : (
            <ItemGrid
              items={visible}
              onLongPressItem={openItemActions}
              topInset={searchActive ? searchHeight : 0}
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
  searchChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xs,
  },
  searchTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingBottom: spacing.xs,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  titleBlock: {
    gap: 2,
  },
  overlayTitle: {
    fontSize: typography.sizes.largeTitle,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "left",
  },
  overlayCount: {
    fontSize: typography.sizes.secondary,
    fontWeight: "600",
    textAlign: "left",
    opacity: 0.85,
  },
  circleGroup: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // sits above the floating tab capsule, like the mockup
  fab: {
    position: "absolute",
    bottom: 118,
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
