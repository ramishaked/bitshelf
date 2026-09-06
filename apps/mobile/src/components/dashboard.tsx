import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { photoOverlay, spacing, typography, type ThemeColors } from "@bitshelf/ui";
import { manufacturersOf, type ItemFilters } from "../lib/filters";
import { categories as seedCategories, isIncomplete, statusColor } from "../lib/retro";
import type { LocalItem } from "../lib/store";
import { useThemeColors } from "../lib/theme";

// Dashboard (spec 7.1a, liquid glass handoff G04): a soft green glow behind
// translucent cards, big mono numbers, and a 4-up working status strip.

const WORKING_ORDER = ["working", "partially_working", "not_working", "untested"] as const;

const HEBREW = /[֐-׿]/;

function money(total: number): string {
  if (total >= 10_000) return `₪${(total / 1000).toFixed(1)}k`;
  return `₪${Math.round(total).toLocaleString("en-US")}`;
}

function Card({
  colors,
  children,
  label,
}: {
  colors: ThemeColors;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder },
      ]}
    >
      {label ? (
        <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      {children}
    </View>
  );
}

function BarRow({
  label,
  count,
  max,
  colors,
  latin,
  onPress,
}: {
  label: string;
  count: number;
  max: number;
  colors: ThemeColors;
  latin?: boolean;
  onPress: () => void;
}) {
  // gradient runs strong to soft away from the label (G04)
  const start = I18nManager.isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 };
  const end = I18nManager.isRTL ? { x: 0, y: 0 } : { x: 1, y: 0 };
  return (
    <Pressable onPress={onPress} style={styles.barRow}>
      <Text
        numberOfLines={1}
        style={[styles.barLabel, { color: colors.textSecondary }, latin && styles.latin]}
      >
        {label}
      </Text>
      <View style={styles.barTrack}>
        <LinearGradient
          colors={[colors.accent, colors.accentSoft]}
          start={start}
          end={end}
          style={[styles.barFill, { width: `${Math.max(6, (count / max) * 100)}%` }]}
        />
      </View>
      <Text style={[styles.barCount, { color: colors.textSecondary }]}>{count}</Text>
    </Pressable>
  );
}

export function Dashboard({
  items,
  onFilter,
  topInset = 0,
  bottomInset = 0,
}: {
  items: LocalItem[];
  // applies a filter and flips the segmented control back to the gallery
  onFilter: (partial: Partial<ItemFilters>) => void;
  // room for the translucent chrome and tab bar (Photos style)
  topInset?: number;
  bottomInset?: number;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();

  const monthAgo = Date.now() - 30 * 86_400_000;
  const addedThisMonth = items.filter(
    (i) => new Date(i.createdAt).getTime() > monthAgo,
  ).length;

  const valued = items.filter((i) => i.valueFair != null);
  const totalFair = valued.reduce((sum, i) => sum + Number(i.valueFair), 0);
  const totalLow = valued.reduce((sum, i) => sum + Number(i.valueLow ?? i.valueFair), 0);
  const totalHigh = valued.reduce((sum, i) => sum + Number(i.valueHigh ?? i.valueFair), 0);

  const statusCounts = new Map<string, number>();
  for (const item of items) {
    const status = (item.attributes.working_status as string) ?? "untested";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const manufacturers = manufacturersOf(items).slice(0, 5);
  const manufacturerCount = (name: string) =>
    items.filter((i) => i.attributes.manufacturer === name).length;
  const maxManufacturer = Math.max(1, ...manufacturers.map(manufacturerCount));

  const categoryCounts = new Map<string, number>();
  for (const item of items) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = Math.max(1, ...topCategories.map(([, n]) => n));

  // needs attention (spec 10a lite): computed on the client from the cache
  const noLocation = items.filter((i) => !i.storageLocation).length;
  const toComplete = items.filter((i) =>
    isIncomplete(i.category, i.attributes, i.conditionGrade),
  ).length;
  const fromScan = items.filter((i) => i.tags?.includes("from_scan")).length;
  const keyOf = (i: LocalItem) =>
    [i.attributes.manufacturer, i.attributes.model, i.attributes.variant]
      .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
      .join("|");
  const keyCounts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key !== "||") keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  const duplicates = [...keyCounts.values()].filter((n) => n > 1).length;

  const attention = [
    toComplete > 0 ? `${toComplete} ${t("item.toComplete")}` : null,
    noLocation > 0 ? `${noLocation} ${t("dashboard.noLocation")}` : null,
    duplicates > 0 ? `${duplicates} ${t("dashboard.duplicates")}` : null,
    fromScan > 0 ? `${fromScan} ${t("dashboard.fromScan")}` : null,
  ].filter((v): v is string => v !== null);
  const attentionTotal = toComplete + noLocation + duplicates + fromScan;

  const recent = items.slice(0, 8);

  return (
    <View style={styles.screen}>
      {/* soft phosphor glow bleeding from the top, per G04 */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.accentSoft, "transparent"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={styles.glowLayer}
      />
      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingTop: topInset + spacing.md, paddingBottom: bottomInset + spacing.xl },
        ]}
      >
        <View style={styles.statsRow}>
          <Card colors={colors}>
            <Text style={[styles.bigStat, styles.mono, { color: colors.textPrimary }]}>
              {items.length}
            </Text>
            <Text style={[styles.statCaption, { color: colors.textSecondary }]}>
              {t("dashboard.items")}
              {addedThisMonth > 0
                ? `, ${t("dashboard.addedThisMonth", { count: addedThisMonth })}`
                : ""}
            </Text>
          </Card>
          {totalFair > 0 ? (
            <Card colors={colors}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.bigStat, styles.mono, { color: colors.accent }]}
              >
                {money(totalFair)}
              </Text>
              <Text style={[styles.statCaption, { color: colors.textSecondary }]}>
                {`${t("dashboard.estimate")}, ${money(totalLow)} ${t("dashboard.to")} ${money(totalHigh)}`}
              </Text>
            </Card>
          ) : null}
        </View>

        {manufacturers.length > 0 ? (
          <Card colors={colors} label={t("dashboard.byManufacturer")}>
            {manufacturers.map((name) => (
              <BarRow
                key={name}
                label={name}
                latin
                count={manufacturerCount(name)}
                max={maxManufacturer}
                colors={colors}
                onPress={() => onFilter({ manufacturer: name })}
              />
            ))}
          </Card>
        ) : null}

        {topCategories.length > 1 ? (
          <Card colors={colors} label={t("dashboard.byCategory")}>
            {topCategories.map(([slug, count]) => (
              <BarRow
                key={slug}
                label={seedCategories.find((c) => c.slug === slug)?.name[lang] ?? slug}
                count={count}
                max={maxCategory}
                colors={colors}
                onPress={() => onFilter({ category: slug })}
              />
            ))}
          </Card>
        ) : null}

        <Card colors={colors} label={t("item.workingStatus")}>
          <View style={styles.statusRow}>
            {WORKING_ORDER.map((status) => (
              <Pressable
                key={status}
                onPress={() => onFilter({ workingStatus: status })}
                style={[
                  styles.statusTile,
                  { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                ]}
              >
                <Text style={[styles.statusCount, { color: statusColor(status, colors) }]}>
                  {statusCounts.get(status) ?? 0}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.statusLabel, { color: colors.textSecondary }]}
                >
                  {t(`status.${status}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {attentionTotal > 0 ? (
          <Pressable onPress={() => onFilter({ toCompleteOnly: true })}>
            <Card colors={colors}>
              <View style={styles.attentionRow}>
                <View style={styles.attentionBody}>
                  <Text style={[styles.attentionTitle, { color: colors.textPrimary }]}>
                    {t("dashboard.needsAttention")}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.attentionSub, { color: colors.textSecondary }]}
                  >
                    {attention.join(", ")}
                  </Text>
                </View>
                <Text style={[styles.attentionTotal, { color: colors.statusNotWorking }]}>
                  {attentionTotal}
                </Text>
              </View>
            </Card>
          </Pressable>
        ) : null}

        {recent.length > 0 ? (
          <Card colors={colors} label={t("galleries.recentlyAdded")}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.recentRow}>
                {recent.map((item) => {
                  const photo = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/item/${item.id}`)}
                      style={[styles.recentTile, { backgroundColor: colors.surface2 }]}
                    >
                      {photo ? (
                        <Image
                          source={{ uri: photo.thumbUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : null}
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.recentName,
                          // mono is for identifying names; Hebrew has no mono glyphs
                          !HEBREW.test(item.title) && styles.recentNameMono,
                        ]}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  glowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 420,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xl,
    gap: spacing.sm + 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  // G04: translucent card, light edge, 22 radius
  card: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 13,
    textAlign: "left",
  },
  bigStat: {
    fontSize: 30,
    fontWeight: "600",
    textAlign: "left",
  },
  mono: {
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
  statCaption: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  barLabel: {
    width: 78,
    fontSize: 13,
    textAlign: "left",
  },
  latin: {
    writingDirection: "ltr",
  },
  barTrack: {
    flex: 1,
    height: 10,
    justifyContent: "center",
  },
  barFill: {
    height: 10,
    borderRadius: 5,
  },
  barCount: {
    width: 30,
    fontSize: typography.sizes.caption,
    fontFamily: typography.mono,
    textAlign: "center",
    writingDirection: "ltr",
  },
  statusRow: {
    flexDirection: "row",
    gap: 6,
  },
  statusTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    gap: 2,
  },
  statusCount: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
  statusLabel: {
    fontSize: 10,
  },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  attentionBody: {
    flex: 1,
    gap: 2,
  },
  attentionTitle: {
    fontSize: 15,
    textAlign: "left",
  },
  attentionSub: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
  },
  attentionTotal: {
    fontSize: 22,
    fontWeight: "600",
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
  recentRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  recentTile: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 4,
  },
  recentName: {
    fontSize: 9,
    color: photoOverlay.text,
    textShadowColor: photoOverlay.gradientEnd,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: "left",
  },
  recentNameMono: {
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
});
