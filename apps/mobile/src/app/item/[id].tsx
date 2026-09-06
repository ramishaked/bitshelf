import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { randomUUID } from "expo-crypto";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import {
  Button,
  photoOverlay,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from "@bitshelf/ui";
import { clerkEnabled } from "../../lib/auth";
import {
  conditionLabels,
  fieldsForCategory,
  isIncomplete,
  isLatinField,
  statusColor,
} from "../../lib/retro";
import { formatMoney } from "../../lib/format";
import {
  ensureModelInfo,
  getCachedModelInfo,
  type ModelInfo,
} from "../../lib/model-info";
import { deletePhotoFiles } from "../../lib/photos";
import {
  addRepair,
  deleteItem,
  getItem,
  listChildren,
  setItemParent,
  updateItemValues,
  type LocalItem,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors } from "../../lib/theme";

function Tag({
  children,
  colors,
  dotColor,
  textColor,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  dotColor?: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface }]}>
      {dotColor ? <View style={[styles.tagDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.tagLabel, { color: textColor ?? colors.textPrimary }]}>
        {children}
      </Text>
    </View>
  );
}

function PhotoViewer({
  photos,
  initialIndex,
  width,
  onClose,
}: {
  photos: LocalItem["photos"];
  initialIndex: number;
  width: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { backgroundColor: photoOverlay.viewerBackground }]}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) =>
            setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {photos.map((photo) => (
            <ScrollView
              key={photo.id}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              contentContainerStyle={styles.viewerPage}
              style={{ width }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={{ width, height: "100%" }}
                contentFit="contain"
              />
            </ScrollView>
          ))}
        </ScrollView>
        <Pressable
          onPress={onClose}
          style={[styles.viewerClose, { backgroundColor: photoOverlay.viewerControl }]}
        >
          <Text style={{ color: photoOverlay.text, fontSize: 17, fontWeight: "600" }}>
            {"×"}
          </Text>
        </Pressable>
        {photos.length > 1 ? (
          <View style={[styles.viewerCounter, { backgroundColor: photoOverlay.viewerControl }]}>
            <Text style={styles.viewerCounterText}>
              {`${current + 1}/${photos.length}`}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// Collapsed by default (spec 7.2, artboard 02): header row with a summary,
// tap expands the content
function FoldCard({
  label,
  summary,
  colors,
  children,
}: {
  label: string;
  summary: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.foldHeader}>
        <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
        <View style={styles.foldSummary}>
          {!open ? (
            <Text
              numberOfLines={1}
              style={[styles.foldSummaryText, { color: colors.textPrimary }]}
            >
              {summary}
            </Text>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {open ? "▴" : "▾"}
          </Text>
        </View>
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </View>
  );
}

const CONFIDENCE_KEY: Record<string, string> = {
  low: "item.confidence_low",
  medium: "item.confidence_medium",
  high: "item.confidence_high",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function ItemScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<LocalItem | null>(null);
  const [children, setChildren] = useState<LocalItem[]>([]);
  const [parent, setParent] = useState<LocalItem | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [serialShown, setSerialShown] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [valueBusy, setValueBusy] = useState(false);
  const [repairText, setRepairText] = useState("");
  // clerkEnabled is constant for the app's lifetime, the hook order is stable
  const { getToken } = clerkEnabled
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth()
    : { getToken: async () => null };
  const [repairCost, setRepairCost] = useState("");

  const reload = useCallback(() => {
    const current = id ? getItem(id) : null;
    setItem(current);
    setChildren(current ? listChildren(current.id) : []);
    setParent(current?.parentItemId ? getItem(current.parentItemId) : null);
  }, [id]);
  useFocusEffect(reload);

  const manufacturer = (item?.attributes.manufacturer as string) ?? "";
  const model = (item?.attributes.model as string) ?? "";
  const variant = (item?.attributes.variant as string) ?? "";

  // "About the model" (spec 4.6.1): cache first; the fetcher component below
  // asks the server and shows a skeleton while generation runs in background
  useEffect(() => {
    setModelInfo(manufacturer && model ? getCachedModelInfo(manufacturer, model) : null);
  }, [manufacturer, model]);

  if (!item) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  const workingStatus = item.attributes.working_status as string | undefined;
  const completeness = item.attributes.completeness as string | undefined;
  const year = item.attributes.year as number | undefined;
  const region = item.attributes.region as string | undefined;
  const incomplete = isIncomplete(item.category, item.attributes, item.conditionGrade);
  const detailFields = fieldsForCategory(item.category).filter((f) => {
    const v = item.attributes[f.key];
    return (
      v != null && v !== "" && f.key !== "working_status" && f.key !== "serial_number"
    );
  });
  const serial = item.attributes.serial_number as string | undefined;
  const repairs = item.repairs ?? [];
  const hasValue = item.valueFair != null || item.valueLow != null;

  const confirmDelete = () => {
    Alert.alert(t("item.deleteConfirmTitle"), t("item.deleteConfirmBody"), [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("item.delete"),
        style: "destructive",
        onPress: () => {
          deletePhotoFiles(item.photos);
          deleteItem(item.id);
          requestSync();
          router.back();
        },
      },
    ]);
  };

  const shareItem = () => {
    // quick share or the post generator (spec 8.2); never the serial
    const quick = () => {
      const parts = [item.title, year != null ? String(year) : null].filter(Boolean);
      void Share.share({ message: parts.join(", ") });
    };
    if (!clerkEnabled) {
      quick();
      return;
    }
    Alert.alert(t("item.share"), "", [
      { text: t("post.quickShare"), onPress: quick },
      { text: t("post.create"), onPress: () => router.push(`/item/post?id=${item.id}`) },
      { text: t("item.cancel"), style: "cancel" },
    ]);
  };

  const removeChild = (child: LocalItem) => {
    Alert.alert(child.title, "", [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("set.remove"),
        style: "destructive",
        onPress: () => {
          setItemParent(child.id, null);
          reload();
          requestSync();
        },
      },
    ]);
  };

  // "update value" (spec 9): eBay asking prices, computed on the server.
  // 503 means the eBay keys are not configured yet.
  const refreshValue = async () => {
    if (valueBusy) return;
    setValueBusy(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"}/api/refresh-value`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ itemId: item.id }),
        },
      );
      if (response.status === 503) {
        Alert.alert(t("item.valueNotConfigured"), "");
        return;
      }
      if (!response.ok) {
        Alert.alert(t("item.valueFailed"), "");
        return;
      }
      const data = (await response.json()) as {
        low: number;
        fair: number;
        high: number;
        confidence: string;
      };
      updateItemValues(item.id, {
        valueLow: String(data.low),
        valueFair: String(data.fair),
        valueHigh: String(data.high),
        valueCurrency: "USD",
        valueConfidence: data.confidence,
        valueUpdatedAt: new Date().toISOString(),
      });
      reload();
    } catch {
      Alert.alert(t("item.valueFailed"), "");
    } finally {
      setValueBusy(false);
    }
  };

  const submitRepair = () => {
    const description = repairText.trim();
    if (!description) return;
    addRepair(item.id, {
      id: randomUUID(),
      date: new Date().toISOString(),
      description,
      cost: repairCost.trim() || null,
    });
    setRepairText("");
    setRepairCost("");
    reload();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {item.photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))
              }
            >
              {item.photos.map((photo, index) => (
                <Pressable key={photo.id} onPress={() => setViewerIndex(index)}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width, height: 260 }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
            {item.photos.length > 1 ? (
              <View style={styles.dots}>
                {item.photos.map((photo, i) => (
                  <View
                    key={photo.id}
                    style={[
                      styles.dotIndicator,
                      {
                        backgroundColor: colors.textPrimary,
                        opacity: i === photoIndex ? 1 : 0.35,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.noPhoto, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.textSecondary }}>{t("item.noPhoto")}</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {[
              year != null ? String(year) : null,
              region ?? null,
              item.storageLocation,
            ]
              .filter(Boolean)
              .join(", ")}
          </Text>

          <View style={styles.tagsRow}>
            <Tag colors={colors} dotColor={statusColor(workingStatus, colors)}>
              {t(`status.${workingStatus ?? "untested"}`)}
            </Tag>
            {item.conditionGrade != null ? (
              <Tag colors={colors}>
                {`${t("item.cosmeticShort")} ${item.conditionGrade}/5`}
              </Tag>
            ) : null}
            {completeness ? (
              <Tag colors={colors}>{t(`completeness.${completeness}`)}</Tag>
            ) : null}
            {incomplete ? (
              <Tag colors={colors} textColor={colors.statusPartiallyWorking}>
                {t("item.toComplete")}
              </Tag>
            ) : null}
            {item.tags?.includes("from_scan") ? (
              <Tag colors={colors} textColor={colors.textSecondary}>
                {t("shelfScan.fromScanTag")}
              </Tag>
            ) : null}
          </View>

          {hasValue ? (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.valueHeader}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                  {t("item.valueSection")}
                </Text>
                <Pressable onPress={() => void refreshValue()} disabled={valueBusy}>
                  <Text style={[styles.valueDate, { color: colors.textSecondary }]}>
                    {`${t("item.valueUpdated")} ${formatDate(item.valueUpdatedAt)}  ·  `}
                    <Text style={{ color: colors.accent }}>
                      {valueBusy ? t("modelInfo.loading") : t("item.valueRefresh")}
                    </Text>
                  </Text>
                </Pressable>
              </View>
              <View style={styles.valueRow}>
                <Text style={[styles.valueSide, { color: colors.textSecondary }]}>
                  {formatMoney(item.valueLow, item.valueCurrency)}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={[styles.valueFair, { color: colors.accent }]}
                >
                  {formatMoney(item.valueFair, item.valueCurrency)}
                </Text>
                <Text style={[styles.valueSide, { color: colors.textSecondary }]}>
                  {formatMoney(item.valueHigh, item.valueCurrency)}
                </Text>
              </View>
              <Text style={[styles.valueNote, { color: colors.textSecondary }]}>
                {t("item.valueEstimate")}
                {item.valueConfidence && CONFIDENCE_KEY[item.valueConfidence]
                  ? `, ${t(CONFIDENCE_KEY[item.valueConfidence] as string)}`
                  : ""}
                {"."}
              </Text>
            </View>
          ) : null}

          {!hasValue && clerkEnabled && manufacturer && model ? (
            <Button
              label={valueBusy ? "..." : t("item.valueRefresh")}
              onPress={() => void refreshValue()}
              colors={colors}
              variant="secondary"
              disabled={valueBusy}
            />
          ) : null}

          {manufacturer && model ? (
            <Pressable
              onPress={() =>
                modelInfo
                  ? router.push(
                      `/item/model-info?manufacturer=${encodeURIComponent(manufacturer)}&model=${encodeURIComponent(model)}`,
                    )
                  : undefined
              }
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              <View style={styles.valueHeader}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                  {t("modelInfo.card")}
                </Text>
                {modelInfo ? (
                  <Text style={[styles.valueDate, { color: colors.accent }]}>
                    {t("modelInfo.more")}
                  </Text>
                ) : null}
              </View>
              {modelInfo ? (
                <>
                  <Text
                    numberOfLines={4}
                    style={[styles.modelSummary, { color: colors.textPrimary }]}
                  >
                    {modelInfo.summary[lang] ?? modelInfo.summary.he}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.modelSpecLine, { color: colors.textSecondary }]}
                  >
                    {[
                      modelInfo.specs.CPU,
                      modelInfo.specs.RAM,
                      modelInfo.releaseYear != null ? String(modelInfo.releaseYear) : null,
                      modelInfo.specs["Launch price"],
                    ]
                      // the mono LTR line only takes pure latin values,
                      // Hebrew fragments would render broken in Menlo
                      .filter((v): v is string => !!v && /^[\x20-\x7E]+$/.test(v))
                      .join(" · ")}
                  </Text>
                </>
              ) : clerkEnabled ? (
                <ModelInfoFetcher
                  manufacturer={manufacturer}
                  model={model}
                  variant={variant}
                  colors={colors}
                  onReady={setModelInfo}
                />
              ) : (
                <Text style={[styles.modelLoading, { color: colors.textSecondary }]}>
                  {t("modelInfo.unavailable")}
                </Text>
              )}
            </Pressable>
          ) : null}

          {(children.length > 0 || (!item.parentItemId && item.photos.length > 0)) && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.valueHeader}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                  {t("set.title")}
                </Text>
                {children.length > 0 ? (
                  <Text style={[styles.valueDate, { color: colors.textSecondary }]}>
                    {t("set.itemCount", { count: children.length })}
                  </Text>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.setRow}>
                  {children.map((child) => {
                    const photo =
                      child.photos.find((p) => p.isPrimary) ?? child.photos[0];
                    return (
                      <Pressable
                        key={child.id}
                        onPress={() => router.push(`/item/${child.id}`)}
                        onLongPress={() => removeChild(child)}
                        style={styles.setTileWrap}
                      >
                        <View style={[styles.setTile, { backgroundColor: colors.surface2 }]}>
                          {photo ? (
                            <Image
                              source={{ uri: photo.thumbUri }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                            />
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[styles.setTileLabel, { color: colors.textSecondary }]}
                        >
                          {child.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => router.push(`/item/set-pick?parentId=${item.id}`)}
                    style={styles.setTileWrap}
                  >
                    <View
                      style={[
                        styles.setTile,
                        styles.setAdd,
                        { borderColor: colors.line, backgroundColor: colors.background },
                      ]}
                    >
                      <Text style={{ color: colors.accent, fontSize: 22 }}>+</Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.setTileLabel, { color: colors.accent }]}
                    >
                      {t("set.add")}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          )}

          {parent ? (
            <Pressable
              onPress={() => router.push(`/item/${parent.id}`)}
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                {t("set.partOf")}
              </Text>
              <Text style={[styles.parentLink, { color: colors.accent }]}>
                {parent.title}
              </Text>
            </Pressable>
          ) : null}

          {item.purchasePrice || item.purchaseSource ? (
            <FoldCard
              label={t("item.purchaseSection")}
              summary={[
                item.purchasePrice
                  ? formatMoney(item.purchasePrice, item.purchaseCurrency)
                  : null,
                item.purchaseSource,
              ]
                .filter(Boolean)
                .join(" · ")}
              colors={colors}
            >
              <Text style={[styles.mono, { color: colors.textPrimary, fontSize: 15 }]}>
                {formatMoney(item.purchasePrice, item.purchaseCurrency)}
                {item.purchaseSource ? `  ·  ${item.purchaseSource}` : ""}
              </Text>
            </FoldCard>
          ) : null}

          {detailFields.length > 0 || serial || item.conditionNotes || item.notes ? (
            <FoldCard
              label={t("item.details")}
              summary={t("item.detailsSummary")}
              colors={colors}
            >
              {detailFields.map((field) => (
                <View key={field.key} style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textSecondary }]}>
                    {field.label[lang]}
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: colors.textPrimary },
                      isLatinField(field.key) && styles.latin,
                      field.key === "year" && styles.mono,
                    ]}
                  >
                    {field.type === "enum"
                      ? field.key === "completeness"
                        ? t(`completeness.${item.attributes[field.key]}`)
                        : field.key === "media_type"
                          ? t(`media.${item.attributes[field.key]}`)
                          : String(item.attributes[field.key])
                      : String(item.attributes[field.key])}
                  </Text>
                </View>
              ))}
              {serial ? (
                // the serial hides behind a tap and never leaves the device
                // in shares (spec 7.2)
                <Pressable
                  onPress={() => setSerialShown((v) => !v)}
                  style={styles.detailRow}
                >
                  <Text style={[styles.detailKey, { color: colors.textSecondary }]}>
                    {lang === "he" ? "מספר סידורי" : "Serial number"}
                  </Text>
                  <Text style={[styles.detailValue, styles.mono, { color: colors.textPrimary }]}>
                    {serialShown ? serial : `•••  (${t("item.tapToReveal")})`}
                  </Text>
                </Pressable>
              ) : null}
              {item.conditionGrade != null ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textSecondary }]}>
                    {t("item.conditionGrade")}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {`${item.conditionGrade}/5 ${conditionLabels[String(item.conditionGrade)]?.[lang] ?? ""}`}
                  </Text>
                </View>
              ) : null}
              {item.conditionNotes ? (
                <Text style={[styles.freeText, { color: colors.textPrimary }]}>
                  {item.conditionNotes}
                </Text>
              ) : null}
              {item.notes ? (
                <Text style={[styles.freeText, { color: colors.textPrimary }]}>
                  {item.notes}
                </Text>
              ) : null}
            </FoldCard>
          ) : null}

          <FoldCard
            label={t("repairs.title")}
            summary={
              repairs.length > 0
                ? t("repairs.count", { count: repairs.length })
                : t("repairs.empty")
            }
            colors={colors}
          >
            {repairs.map((repair) => (
              <View key={repair.id} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textSecondary }]}>
                  {formatDate(repair.date)}
                </Text>
                <Text
                  style={[styles.detailValue, { color: colors.textPrimary, flex: 1, textAlign: "left", marginStart: spacing.md }]}
                >
                  {repair.description}
                  {repair.cost ? `  ·  ₪${repair.cost}` : ""}
                </Text>
              </View>
            ))}
            <View style={styles.repairForm}>
              <TextInput
                value={repairText}
                onChangeText={setRepairText}
                placeholder={t("repairs.descPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.repairInput,
                  { backgroundColor: colors.surface2, color: colors.textPrimary },
                ]}
              />
              <TextInput
                value={repairCost}
                onChangeText={setRepairCost}
                placeholder={t("repairs.costPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                style={[
                  styles.repairInput,
                  { backgroundColor: colors.surface2, color: colors.textPrimary },
                ]}
              />
              <Button
                label={t("repairs.add")}
                onPress={submitRepair}
                colors={colors}
              />
            </View>
          </FoldCard>

          {!item.synced ? (
            <Text style={[styles.syncNote, { color: colors.textSecondary }]}>
              {t("item.notSynced")}
            </Text>
          ) : null}

          {viewerIndex != null ? (
            <PhotoViewer
              photos={item.photos}
              initialIndex={viewerIndex}
              width={width}
              onClose={() => setViewerIndex(null)}
            />
          ) : null}

          <View style={styles.actions}>
            <Button
              label={t("item.edit")}
              onPress={() => router.push(`/item/new?id=${item.id}`)}
              colors={colors}
              style={styles.action}
            />
            <Button
              label={t("item.share")}
              onPress={shareItem}
              colors={colors}
              variant="secondary"
              style={styles.action}
            />
            <Button
              label={t("item.delete")}
              onPress={confirmDelete}
              colors={colors}
              variant="destructive"
              style={styles.action}
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// separate component so useAuth is only called when ClerkProvider exists
function ModelInfoFetcher({
  manufacturer,
  model,
  variant,
  colors,
  onReady,
}: {
  manufacturer: string;
  model: string;
  variant: string;
  colors: ThemeColors;
  onReady: (info: ModelInfo) => void;
}) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void ensureModelInfo(manufacturer, model, variant, getToken).then((info) => {
      if (cancelled) return;
      if (info) {
        onReady(info);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [manufacturer, model, variant, getToken, onReady]);
  return (
    <Text style={[styles.modelLoading, { color: colors.textSecondary }]}>
      {failed ? t("modelInfo.unavailable") : t("modelInfo.loading")}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  noPhoto: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: "700",
    writingDirection: "ltr",
    textAlign: "left",
  },
  subtitle: {
    fontSize: typography.sizes.secondary,
    textAlign: "left",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.tag,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagLabel: {
    fontSize: 13,
  },
  card: {
    borderRadius: radius.card,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 13,
    textAlign: "left",
  },
  valueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  // mixes Hebrew words with a date, stays in the UI font
  valueDate: {
    fontSize: typography.sizes.caption,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  // fair value in mono accent, low and high in mono muted (design); the fair
  // shrinks instead of pushing the sides off the card
  valueFair: {
    flexShrink: 1,
    fontFamily: typography.mono,
    fontSize: 24,
    fontWeight: "700",
    writingDirection: "ltr",
  },
  valueSide: {
    fontFamily: typography.mono,
    fontSize: 12,
    writingDirection: "ltr",
  },
  valueNote: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
  },
  modelSummary: {
    fontSize: typography.sizes.secondary,
    lineHeight: 20,
    textAlign: "left",
  },
  modelSpecLine: {
    fontFamily: typography.mono,
    fontSize: typography.sizes.caption,
    writingDirection: "ltr",
    textAlign: "left",
  },
  modelLoading: {
    fontSize: typography.sizes.secondary,
    textAlign: "left",
  },
  setRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  setTileWrap: {
    width: 64,
    gap: 2,
  },
  setTile: {
    width: 64,
    height: 64,
    borderRadius: radius.tag,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  setAdd: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  setTileLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  parentLink: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
    textAlign: "left",
    writingDirection: "ltr",
  },
  foldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  foldSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  foldSummaryText: {
    fontSize: typography.sizes.secondary,
    writingDirection: "ltr",
  },
  foldBody: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  detailKey: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: typography.sizes.secondary,
  },
  latin: {
    writingDirection: "ltr",
  },
  mono: {
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
  freeText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  repairForm: {
    gap: spacing.sm,
  },
  repairInput: {
    height: 40,
    borderRadius: radius.tag,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.secondary,
    textAlign: "right",
  },
  repairAdd: {
    height: 40,
    borderRadius: radius.tag,
    alignItems: "center",
    justifyContent: "center",
  },
  syncNote: {
    fontSize: typography.sizes.caption,
    textAlign: "center",
  },
  viewer: {
    flex: 1,
  },
  viewerPage: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerClose: {
    position: "absolute",
    top: 58,
    end: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 44,
    alignSelf: "center",
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  viewerCounterText: {
    color: photoOverlay.text,
    fontFamily: typography.mono,
    fontSize: 13,
    writingDirection: "ltr",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
