import { useCallback, useEffect, useMemo, useState } from "react";
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
import { GlassActionBar } from "../../components/glass-action-bar";
import { GlassFilterChips } from "../../components/glass-filter-chips";
import { GLASS_TAB_BAR_INSET } from "../../components/glass-tab-bar";
import { ItemGrid } from "../../components/item-grid";
import { ScreenHeader } from "../../components/screen-header";
import {
  applyFilters,
  emptyFilters,
  hasActiveFilters,
  type ItemFilters,
} from "../../lib/filters";
import {
  deleteItem,
  getItem,
  getSetting,
  listItems,
  setItemPrivate,
  setSetting,
  toggleFavorite,
  type LocalItem,
} from "../../lib/store";
import { deletePhotoFiles } from "../../lib/photos";
import { requestSync } from "../../lib/sync";
import { useThemeColors, useThemeName } from "../../lib/theme";

// Collection laid out like the iOS 26 Photos app (Rami, 06.09.2026):
// top row carries the title with an item count under it, plus select and a
// sort/filter/display menu; the bottom row floats a search circle beside
// the gallery/dashboard pill (Photos' search + library/collections). The
// wall itself stays clean: filter chips appear only while a filter is on.

type SortKey = "added" | "year" | "manufacturer";
type MenuPage = "main" | "filter" | "display";

const SORT_SETTING = "collection_sort";

function sortItems(items: LocalItem[], sort: SortKey): LocalItem[] {
  if (sort === "added") return items;
  const copy = [...items];
  if (sort === "year") {
    const yearOf = (i: LocalItem) => {
      const y = Number(i.attributes.year);
      return Number.isFinite(y) && y > 1900 ? y : 9999;
    };
    copy.sort((a, b) => yearOf(a) - yearOf(b));
  } else {
    const manOf = (i: LocalItem) =>
      ((i.attributes.manufacturer as string) ?? "￿").toLowerCase();
    copy.sort((a, b) => manOf(a).localeCompare(manOf(b)) || a.title.localeCompare(b.title));
  }
  return copy;
}

// one row of the dropdown menu (Photos style: label, optional checkmark)
function MenuRow({
  label,
  checked,
  chevron,
  color,
  onPress,
}: {
  label: string;
  checked?: boolean;
  chevron?: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      {checked ? (
        <Text style={[styles.menuMark, { color }]}>{"✓"}</Text>
      ) : chevron ? (
        <Text style={[styles.menuMark, { color }]}>{"‹"}</Text>
      ) : null}
    </Pressable>
  );
}

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
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null);
  const [sort, setSort] = useState<SortKey>(
    () => (getSetting(SORT_SETTING) as SortKey) ?? "added",
  );
  const [showNames, setShowNames] = useState(
    () => getSetting("collection_tile_names") === "1",
  );
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // deep links (?view=dashboard) must also switch an already-mounted screen
  useEffect(() => {
    if (viewParam === "dashboard" || viewParam === "gallery") setView(viewParam);
  }, [viewParam]);

  const reload = useCallback(() => setItems(listItems()), []);
  useFocusEffect(reload);

  const visible = useMemo(
    () => sortItems(applyFilters(items, filters), sort),
    [items, filters, sort],
  );
  const gallery = view === "gallery";
  const filtered = hasActiveFilters(filters);

  const pickSort = (key: SortKey) => {
    setSort(key);
    setSetting(SORT_SETTING, key);
    setMenuPage(null);
  };

  // menu filters are single choice, like Photos' filter submenu; the chips
  // row appears once a filter is active for finer control
  const pickFilter = (partial: Partial<ItemFilters>) => {
    setFilters({ ...emptyFilters, query: filters.query, ...partial });
    setMenuPage(null);
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const toggleSelected = (item: LocalItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const forSelected = (apply: (id: string) => void) => {
    for (const id of selected) apply(id);
    reload();
    requestSync();
    stopSelecting();
  };

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={t("collection.title")} />
        <EmptyState title={t("collection.emptyTitle")} colors={colors} showLogo />
      </View>
    );
  }

  const overPhotos = gallery && !showNames;
  const titleColor = gallery ? photoOverlay.text : colors.textPrimary;
  const subColor = gallery ? photoOverlay.glassText : colors.textSecondary;

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
            showNames={showNames}
            selectedIds={selecting ? selected : undefined}
            onPressItem={selecting ? toggleSelected : undefined}
            onLongPressItem={
              selecting
                ? undefined
                : (item) => {
                    // long press enters selection with the pressed item
                    setSelecting(true);
                    setSelected(new Set([item.id]));
                  }
            }
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
            {/* Photos style: title with the item count right under it */}
            <View>
              <Text
                style={[
                  styles.title,
                  { color: titleColor },
                  overPhotos && { textShadowColor: photoOverlay.dotRing },
                ]}
              >
                {t("collection.title")}
              </Text>
              <Text style={[styles.subtitle, { color: subColor }]}>
                {selecting
                  ? t("menu.selectedCount", { count: selected.size })
                  : t("collection.itemCount", {
                      count: filtered ? visible.length : items.length,
                    })}
              </Text>
            </View>
            {gallery ? (
              <View style={styles.titleControls}>
                <Pressable
                  onPress={selecting ? stopSelecting : () => setSelecting(true)}
                  style={[styles.selectPill, { borderColor: photoOverlay.glassBorder }]}
                >
                  <BlurView
                    tint={themeName === "dark" ? "dark" : "light"}
                    intensity={60}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.selectLabel}>
                    {selecting ? t("item.cancel") : t("menu.select")}
                  </Text>
                </Pressable>
                {!selecting ? (
                  <Pressable
                    onPress={() => setMenuPage(menuPage ? null : "main")}
                    style={[styles.circle, { borderColor: photoOverlay.glassBorder }]}
                  >
                    <BlurView
                      tint={themeName === "dark" ? "dark" : "light"}
                      intensity={60}
                      style={StyleSheet.absoluteFill}
                    />
                    <SymbolView
                      name="line.3.horizontal"
                      size={16}
                      tintColor={photoOverlay.text}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        {gallery && filtered && !selecting ? (
          <View style={styles.chipsRow}>
            <GlassFilterChips
              items={items}
              totalCount={items.length}
              filters={filters}
              onChange={setFilters}
            />
          </View>
        ) : null}

        {/* the Photos bottom row. RTL puts the first child on the physical
            right, so the pill comes first and search lands at the left */}
        {!selecting && !searchActive ? (
          <View pointerEvents="box-none" style={styles.bottomRow}>
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
            <Pressable
              onPress={() => {
                setView("gallery");
                setSearchActive(true);
              }}
              style={[styles.searchCircle, { borderColor: photoOverlay.glassBorder }]}
            >
              <BlurView
                tint={themeName === "dark" ? "dark" : "light"}
                intensity={80}
                style={StyleSheet.absoluteFill}
              />
              <SymbolView name="magnifyingglass" size={18} tintColor={photoOverlay.text} />
            </Pressable>
          </View>
        ) : null}

        {/* sort / filter / display dropdown, opened from the menu circle */}
        {menuPage ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuPage(null)} />
            <View
              style={[
                styles.menu,
                {
                  top: insets.top + 64,
                  backgroundColor: colors.glassCard,
                  borderColor: colors.glassCardBorder,
                },
              ]}
            >
              <BlurView
                tint={themeName === "dark" ? "dark" : "light"}
                intensity={90}
                style={StyleSheet.absoluteFill}
              />
              {menuPage === "main" ? (
                <>
                  <MenuRow
                    label={t("menu.sortAdded")}
                    checked={sort === "added"}
                    color={colors.textPrimary}
                    onPress={() => pickSort("added")}
                  />
                  <MenuRow
                    label={t("menu.sortYear")}
                    checked={sort === "year"}
                    color={colors.textPrimary}
                    onPress={() => pickSort("year")}
                  />
                  <MenuRow
                    label={t("menu.sortManufacturer")}
                    checked={sort === "manufacturer"}
                    color={colors.textPrimary}
                    onPress={() => pickSort("manufacturer")}
                  />
                  <View style={[styles.menuSeparator, { backgroundColor: colors.tileBorder }]} />
                  <MenuRow
                    label={t("menu.filter")}
                    chevron
                    color={colors.textPrimary}
                    onPress={() => setMenuPage("filter")}
                  />
                  <MenuRow
                    label={t("menu.display")}
                    chevron
                    color={colors.textPrimary}
                    onPress={() => setMenuPage("display")}
                  />
                </>
              ) : menuPage === "filter" ? (
                <>
                  <MenuRow
                    label={t("filters.all")}
                    checked={!filtered}
                    color={colors.textPrimary}
                    onPress={() => pickFilter({})}
                  />
                  <MenuRow
                    label={t("filters.favorites")}
                    checked={filters.favoritesOnly}
                    color={colors.textPrimary}
                    onPress={() => pickFilter({ favoritesOnly: true })}
                  />
                  <MenuRow
                    label={t("item.toComplete")}
                    checked={filters.toCompleteOnly}
                    color={colors.textPrimary}
                    onPress={() => pickFilter({ toCompleteOnly: true })}
                  />
                  <MenuRow
                    label={t("filters.privateOnly")}
                    checked={filters.privateOnly}
                    color={colors.textPrimary}
                    onPress={() => pickFilter({ privateOnly: true })}
                  />
                  <View style={[styles.menuSeparator, { backgroundColor: colors.tileBorder }]} />
                  {(["working", "partially_working", "not_working", "untested"] as const).map(
                    (status) => (
                      <MenuRow
                        key={status}
                        label={t(`status.${status}`)}
                        checked={filters.workingStatus === status}
                        color={colors.textPrimary}
                        onPress={() => pickFilter({ workingStatus: status })}
                      />
                    ),
                  )}
                </>
              ) : (
                <MenuRow
                  label={t("menu.tileNames")}
                  checked={showNames}
                  color={colors.textPrimary}
                  onPress={() => {
                    const next = !showNames;
                    setShowNames(next);
                    setSetting("collection_tile_names", next ? "1" : "0");
                    setMenuPage(null);
                  }}
                />
              )}
            </View>
          </>
        ) : null}
      </View>

      {/* selection actions, like Photos' bottom bar in select mode */}
      {selecting ? (
        <GlassActionBar
          aboveTabBar
          actions={[
            {
              label: t("actions.favorite"),
              onPress: () => forSelected((id) => toggleFavorite(id)),
              variant: "primary",
            },
            {
              label: t("actions.makePrivate"),
              onPress: () => forSelected((id) => setItemPrivate(id, true)),
            },
            {
              label: t("actions.addToGallery"),
              onPress: () => {
                if (selected.size === 0) return;
                const ids = [...selected].join(",");
                stopSelecting();
                router.push(`/gallery/pick?itemId=${ids}`);
              },
            },
            {
              label: t("item.delete"),
              variant: "destructive",
              onPress: () => {
                if (selected.size === 0) return;
                Alert.alert(
                  t("menu.deleteSelectedTitle", { count: selected.size }),
                  t("menu.deleteSelectedBody"),
                  [
                    { text: t("item.cancel"), style: "cancel" },
                    {
                      text: t("item.delete"),
                      style: "destructive",
                      onPress: () =>
                        forSelected((id) => {
                          const item = getItem(id);
                          if (item) deletePhotoFiles(item.photos);
                          deleteItem(id);
                        }),
                    },
                  ],
                );
              },
            },
          ]}
        />
      ) : null}
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
  // no fixed height: paddingTop carries the device inset, content sets the rest
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg + spacing.xs,
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
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1,
    textAlign: "left",
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
  selectPill: {
    height: 38,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: photoOverlay.text,
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
  titleControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  // Photos puts search at one end and the section pill at the other
  bottomRow: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 110,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: radius.chip,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  menu: {
    position: "absolute",
    left: spacing.lg,
    width: 250,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: spacing.xs,
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 3,
    gap: spacing.md,
  },
  menuLabel: {
    fontSize: 15,
    textAlign: "left",
    flex: 1,
  },
  menuMark: {
    fontSize: 14,
    fontWeight: "600",
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
});
