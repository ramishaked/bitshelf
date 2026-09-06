import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { EmptyState, photoOverlay, radius, spacing, typography } from "@bitshelf/ui";
import { Dashboard } from "../../components/dashboard";
import { GlassFilterChips } from "../../components/glass-filter-chips";
import { GLASS_TAB_BAR_INSET } from "../../components/glass-tab-bar";
import { ItemGrid } from "../../components/item-grid";
import { ScreenHeader } from "../../components/screen-header";
import { applyFilters, emptyFilters } from "../../lib/filters";
import {
  listItems,
  setItemPrivate,
  toggleFavorite,
  type LocalItem,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors, useThemeName } from "../../lib/theme";

// Collection per the liquid glass handoff (G01): the photo wall runs edge
// to edge under everything, the title and glass controls float on scrims,
// filters are always-visible glass capsules, and the gallery/dashboard
// switch is a floating glass segmented pill above the tab row.

export default function CollectionScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const themeName = useThemeName();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<LocalItem[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const { view: viewParam } = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<"gallery" | "dashboard">(
    viewParam === "dashboard" ? "dashboard" : "gallery",
  );
  const [searchActive, setSearchActive] = useState(false);

  const reload = useCallback(() => setItems(listItems()), []);
  useFocusEffect(reload);

  const visible = useMemo(() => applyFilters(items, filters), [items, filters]);
  const gallery = view === "gallery";

  // long press menu (spec 7.1): favorite, private/visible, add to gallery
  const openItemActions = (item: LocalItem) => {
    Alert.alert(item.title, "", [
      {
        text: item.isFavorite ? t("actions.unfavorite") : t("actions.favorite"),
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

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={t("collection.title")} />
        <EmptyState title={t("collection.emptyTitle")} colors={colors} showLogo />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {gallery ? (
        visible.length === 0 ? (
          <View style={{ flex: 1, paddingTop: insets.top + 110 }}>
            <EmptyState title={t("filters.noResults")} colors={colors} />
          </View>
        ) : (
          <ItemGrid
            items={visible}
            onLongPressItem={openItemActions}
            bottomInset={GLASS_TAB_BAR_INSET + 46}
          />
        )
      ) : (
        <Dashboard
          items={items}
          topInset={insets.top + 56}
          bottomInset={GLASS_TAB_BAR_INSET + 46}
          onFilter={(partial) => {
            setFilters({ ...emptyFilters, ...partial });
            setView("gallery");
          }}
        />
      )}

      {/* scrims keep the floating layer readable over photos (G01) */}
      {gallery ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[photoOverlay.scrim, photoOverlay.scrimMid, photoOverlay.gradientStart]}
            locations={[0, 0.6, 1]}
            style={styles.topScrim}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[photoOverlay.gradientStart, photoOverlay.scrimBottom]}
            style={styles.bottomScrim}
          />
        </>
      ) : null}

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {searchActive && gallery ? (
          <View style={[styles.searchWrap, { paddingTop: insets.top + spacing.xs }]}>
            <BlurView
              tint={themeName === "dark" ? "dark" : "light"}
              intensity={80}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.searchRow}>
              <TextInput
                value={filters.query}
                onChangeText={(query) => setFilters({ ...filters, query })}
                placeholder={t("filters.searchPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoFocus
                style={[
                  styles.searchInput,
                  { backgroundColor: colors.surface, color: colors.textPrimary },
                ]}
              />
              <Pressable
                onPress={() => {
                  setSearchActive(false);
                  setFilters({ ...filters, query: "" });
                }}
              >
                <Text style={{ color: colors.accent, fontSize: typography.sizes.body }}>
                  {t("item.cancel")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            pointerEvents="box-none"
            style={[styles.titleRow, { paddingTop: insets.top + spacing.sm }]}
          >
            <Text
              style={[
                styles.title,
                gallery
                  ? { color: photoOverlay.text, textShadowColor: photoOverlay.dotRing }
                  : { color: colors.textPrimary },
              ]}
            >
              {t("collection.title")}
            </Text>
            {gallery ? (
              <Pressable
                onPress={() => setSearchActive(true)}
                style={[styles.circle, { borderColor: photoOverlay.glassBorder }]}
              >
                <BlurView
                  tint={themeName === "dark" ? "dark" : "light"}
                  intensity={60}
                  style={StyleSheet.absoluteFill}
                />
                <SymbolView name="magnifyingglass" size={16} tintColor={photoOverlay.text} />
              </Pressable>
            ) : null}
          </View>
        )}

        {gallery ? (
          <View style={styles.chipsRow}>
            <GlassFilterChips
              items={items}
              totalCount={items.length}
              filters={filters}
              onChange={setFilters}
            />
          </View>
        ) : null}

        {/* floating glass segmented pill (G01), above the tab row */}
        <View pointerEvents="box-none" style={styles.segmentedWrap}>
          <View style={[styles.segmented, { borderColor: photoOverlay.glassBorder }]}>
            <BlurView
              tint={themeName === "dark" ? "dark" : "light"}
              intensity={80}
              style={StyleSheet.absoluteFill}
            />
            {(["gallery", "dashboard"] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => setView(key)}
                style={[
                  styles.segment,
                  view === key && { backgroundColor: photoOverlay.segmentActive },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    {
                      color:
                        view === key
                          ? gallery || themeName === "dark"
                            ? photoOverlay.text
                            : colors.textPrimary
                          : gallery || themeName === "dark"
                            ? photoOverlay.glassText
                            : colors.textSecondary,
                    },
                  ]}
                >
                  {t(`dashboard.${key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 170,
  },
  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 190,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg + spacing.xs,
    height: 96,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "left",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: {
    marginTop: spacing.sm,
  },
  searchWrap: {
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg + spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.secondary + 1,
    // TextInput alignment is physical on iOS, right hugs the RTL start
    textAlign: "right",
  },
  segmentedWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: "center",
  },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  segment: {
    paddingVertical: 7,
    paddingHorizontal: 22,
    borderRadius: radius.chip,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
