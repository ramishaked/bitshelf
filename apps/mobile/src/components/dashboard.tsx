import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { radius, spacing, typography, type ThemeColors } from "@bitshelf/ui";
import { manufacturersOf, type ItemFilters } from "../lib/filters";
import { categories as seedCategories, isIncomplete, statusColor } from "../lib/retro";
import type { LocalItem } from "../lib/store";
import { useThemeColors } from "../lib/theme";

// Dashboard (spec 7.1a, artboard 04): one vertical scroll of cards computed
// from the local cache. Taps open the gallery filtered.

const WORKING_ORDER = ["working", "partially_working", "not_working", "untested"] as const;

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
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
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
  return (
    <Pressable onPress={onPress} style={styles.barRow}>
      <Text
        numberOfLines={1}
        style={[styles.barLabel, { color: colors.textPrimary }, latin && styles.latin]}
      >
        {label}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: colors.surface2 }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: colors.accentPressed, width: `${(count / max) * 100}%` },
          ]}
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

  const recent = items.slice(0, 8);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.list,
        { paddingTop: topInset + spacing.md, paddingBottom: bottomInset + spacing.xl },
      ]}
    >
      <View style={styles.statsRow}>
        <Card colors={colors}>
          <Text style={[styles.bigStat, { color: colors.textPrimary }]}>
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
            <Text style={[styles.bigStat, styles.mono, { color: colors.accent }]}>
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
              style={styles.statusCell}
            >
              <View style={styles.statusTop}>
                <View
                  style={[styles.dot, { backgroundColor: statusColor(status, colors) }]}
                />
                <Text style={[styles.statusCount, { color: colors.textPrimary }]}>
                  {statusCounts.get(status) ?? 0}
                </Text>
              </View>
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

      {noLocation + toComplete + fromScan + duplicates > 0 ? (
        <Card colors={colors} label={t("dashboard.needsAttention")}>
          {toComplete > 0 ? (
            <Pressable onPress={() => onFilter({ toCompleteOnly: true })}>
              <Text style={[styles.attention, { color: colors.textPrimary }]}>
                {`${toComplete} ${t("item.toComplete")}`}
              </Text>
            </Pressable>
          ) : null}
          {noLocation > 0 ? (
            <Text style={[styles.attention, { color: colors.textPrimary }]}>
              {`${noLocation} ${t("dashboard.noLocation")}`}
            </Text>
          ) : null}
          {duplicates > 0 ? (
            <Text style={[styles.attention, { color: colors.textPrimary }]}>
              {`${duplicates} ${t("dashboard.duplicates")}`}
            </Text>
          ) : null}
          {fromScan > 0 ? (
            <Text style={[styles.attention, { color: colors.textPrimary }]}>
              {`${fromScan} ${t("dashboard.fromScan")}`}
            </Text>
          ) : null}
        </Card>
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
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xl,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 13,
    textAlign: "left",
  },
  bigStat: {
    fontSize: 26,
    fontWeight: "700",
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
    width: 96,
    fontSize: typography.sizes.secondary,
    textAlign: "left",
  },
  latin: {
    writingDirection: "ltr",
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 4,
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
    gap: spacing.sm,
  },
  statusCell: {
    flex: 1,
    gap: 2,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusCount: {
    fontSize: typography.sizes.body,
    fontWeight: "700",
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
  statusLabel: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
  },
  attention: {
    fontSize: typography.sizes.secondary,
    textAlign: "left",
  },
  recentRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  recentTile: {
    width: 56,
    height: 56,
    borderRadius: radius.tag,
    overflow: "hidden",
  },
});
