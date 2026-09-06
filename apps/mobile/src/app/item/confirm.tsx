import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import { photoOverlay, radius, spacing, typography } from "@bitshelf/ui";
import {
  GLASS_ACTION_BAR_INSET,
  GlassActionBar,
} from "../../components/glass-action-bar";
import {
  applyMapsTo,
  buildTitle,
  conditionLabels,
  fieldsForCategory,
  isLatinField,
  type AttributeField,
} from "../../lib/retro";
import { identifyPhotos, type IdentifyResult } from "../../lib/identify";
import { deletePhotoFiles } from "../../lib/photos";
import { takePendingPhotos } from "../../lib/pending";
import {
  findDuplicate,
  newItemId,
  saveItem,
  type LocalItem,
  type LocalPhoto,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { clerkEnabled } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";
import { Redirect } from "expo-router";

const LOW_CONFIDENCE = 0.7;

// identification requires a signed-in session for the server call
export default function ConfirmScreen() {
  if (!clerkEnabled) {
    return <Redirect href="/item/new" />;
  }
  return <ConfirmInner />;
}

// Confirm screen after AI identification (spec 6.1 steps 4 and 5, liquid
// glass handoff G03): glass field card over a soft glow, low-confidence
// fields in amber, alternatives as chips, condition and working status as
// two separate pickers, nothing blocks saving.
function ConfirmInner() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  const { getToken } = useAuth();

  const [photos] = useState<LocalPhoto[]>(() => takePendingPhotos());
  const [phase, setPhase] = useState<"identifying" | "ready" | "failed">("identifying");
  const [ai, setAi] = useState<IdentifyResult | null>(null);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("other");
  const [conditionGrade, setConditionGrade] = useState<number | null>(null);
  const [workingStatus, setWorkingStatus] = useState("untested");
  const [storageLocation, setStorageLocation] = useState("");
  const [seconds, setSeconds] = useState<string | null>(null);
  const startedAt = useRef(0);

  const runIdentify = async () => {
    setPhase("identifying");
    startedAt.current = Date.now();
    try {
      const result = await identifyPhotos(photos, getToken);
      setSeconds(((Date.now() - startedAt.current) / 1000).toFixed(1));
      setAi(result);
      setCategory(result.category ?? "other");
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(result.attributes ?? {})) {
        if (value != null && value !== "") next[key] = String(value);
      }
      setAttrs(next);
      setPhase("ready");
    } catch (err) {
      console.warn("identify failed", err);
      setPhase("failed");
    }
  };

  useEffect(() => {
    if (photos.length === 0) {
      router.back();
      return;
    }
    void runIdentify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fields = useMemo(
    () => fieldsForCategory(category).filter((f) => f.key !== "working_status"),
    [category],
  );
  const fieldConfidence = ai?.field_confidence ?? {};
  const isLow = (key: string) => {
    const c = fieldConfidence[key];
    return typeof c === "number" && c < LOW_CONFIDENCE;
  };

  const persistItem = () => {
    const cleanAttrs: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = attrs[field.key]?.trim();
      if (!raw) continue;
      cleanAttrs[field.key] =
        field.type === "int" || field.type === "decimal" ? Number(raw) : raw;
    }
    cleanAttrs.working_status = workingStatus;
    const finalAttrs = applyMapsTo(category, cleanAttrs);
    const now = new Date().toISOString();
    const item: LocalItem = {
      id: newItemId(),
      category,
      title: buildTitle(category, finalAttrs, t("item.untitled")),
      attributes: finalAttrs,
      conditionGrade,
      // visible-condition remarks from the AI (spec 6.2)
      conditionNotes: ai?.notes ?? null,
      storageLocation: storageLocation.trim() || null,
      notes: null,
      purchasePrice: null,
      purchaseCurrency: null,
      purchaseSource: null,
      isPrivate: true,
      isFavorite: false,
      photos: photos.map((p, i) => ({ ...p, isPrimary: i === 0 })),
      createdAt: now,
      updatedAt: now,
      synced: false,
    };
    saveItem(item);
    requestSync();
    router.dismissAll();
  };

  const save = () => {
    const dup = findDuplicate(attrs.manufacturer, attrs.model, attrs.variant);
    if (dup) {
      Alert.alert(
        t("confirm.duplicateTitle", { title: dup.title }),
        t("confirm.duplicateBody"),
        [
          { text: t("item.cancel"), style: "cancel" },
          { text: t("confirm.addCopy"), onPress: persistItem },
        ],
      );
      return;
    }
    persistItem();
  };

  const retake = () => {
    deletePhotoFiles(photos);
    router.back();
  };

  if (phase === "identifying") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {photos[0] ? (
          <Image source={{ uri: photos[0].uri }} style={styles.loadingPhoto} />
        ) : null}
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
          {t("confirm.identifying")}
        </Text>
      </View>
    );
  }

  if (phase === "failed") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>
          {t("confirm.failed")}
        </Text>
        <Pressable onPress={() => void runIdentify()}>
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "600" }}>
            {t("confirm.retry")}
          </Text>
        </Pressable>
        <Pressable onPress={retake}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
            {t("confirm.retake")}
          </Text>
        </Pressable>
      </View>
    );
  }

  // one row inside the glass field card (G03): label start, value end
  const renderRow = (field: AttributeField, last = false) => {
    if (field.key === "completeness" || field.key === "serial_number") {
      return null; // completed later from the item form, keep confirm short
    }
    const low = isLow(field.key);
    const ltr = isLatinField(field.key) || field.type === "int";
    return (
      <View
        key={field.key}
        style={[styles.row, !last && { borderBottomColor: colors.tileBorder }]}
      >
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
          {field.label[lang]}
          {low ? (
            <Text style={{ color: colors.statusPartiallyWorking, fontSize: 11 }}>
              {"  " + t("confirm.check")}
            </Text>
          ) : null}
        </Text>
        <TextInput
          value={attrs[field.key] ?? ""}
          onChangeText={(v) => setAttrs((prev) => ({ ...prev, [field.key]: v }))}
          keyboardType={field.type === "int" ? "number-pad" : "default"}
          autoCapitalize={ltr ? "none" : "sentences"}
          style={[
            styles.rowInput,
            {
              color: low ? colors.statusPartiallyWorking : colors.textPrimary,
            },
            ltr && styles.ltr,
            field.type === "int" && styles.monoInput,
          ]}
        />
      </View>
    );
  };

  const alternatives = ai?.alternatives ?? [];
  const primaryFields = fields.filter((f) =>
    ["manufacturer", "model", "title"].includes(f.key),
  );
  const restFields = fields.filter(
    (f) =>
      !["manufacturer", "model", "title", "completeness", "serial_number"].includes(f.key),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* soft glow bleeding from the top, per G03 */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.accentSoft, "transparent"]}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={styles.glowLayer}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("confirm.title")}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("confirm.subtitle")}
        </Text>

        {photos[0] ? (
          <View style={[styles.hero, { borderColor: colors.glassCardBorder }]}>
            <Image source={{ uri: photos[0].uri }} style={StyleSheet.absoluteFill} />
            <View style={[styles.heroBadge, { backgroundColor: photoOverlay.viewerControl }]}>
              <Text style={styles.heroBadgeText}>
                {t("confirm.badge", { count: photos.length })}
                {seconds ? `, ${t("confirm.badgeSeconds", { seconds })}` : ""}
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.fieldCard,
            { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder },
          ]}
        >
          {primaryFields.map((f) => renderRow(f))}

          {alternatives.length > 0 ? (
            <View style={[styles.altRow, { borderBottomColor: colors.tileBorder }]}>
              {alternatives.map((alt) => {
                const active = attrs.model === alt;
                return (
                  <Pressable
                    key={alt}
                    onPress={() => setAttrs((prev) => ({ ...prev, model: alt }))}
                    style={[
                      styles.altChip,
                      active
                        ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
                        : { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.altLabel,
                        { color: active ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {alt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {restFields.map((f, i) => renderRow(f, i === restFields.length - 1))}
        </View>

        <View style={styles.pickers}>
          <View
            style={[
              styles.pickerCard,
              { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder },
            ]}
          >
            <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
              {t("item.conditionGrade")}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((grade) => (
                <Pressable
                  key={grade}
                  onPress={() => setConditionGrade(conditionGrade === grade ? null : grade)}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      color:
                        conditionGrade != null && grade <= conditionGrade
                          ? colors.accent
                          : colors.line,
                    }}
                  >
                    {"★"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {conditionGrade != null ? (
              <Text style={[styles.pickerHint, { color: colors.textSecondary }]}>
                {conditionLabels[String(conditionGrade)]?.[lang]}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.pickerCard,
              { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder },
            ]}
          >
            <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
              {t("item.workingStatus")}
            </Text>
            <View style={styles.statusWrap}>
              {["working", "partially_working", "not_working", "untested", "for_parts"].map(
                (value) => {
                  const active = workingStatus === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setWorkingStatus(value)}
                      style={[
                        styles.statusChip,
                        active
                          ? { backgroundColor: colors.textPrimary }
                          : {
                              backgroundColor: colors.tileBg,
                              borderWidth: 1,
                              borderColor: colors.tileBorder,
                            },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: active ? "600" : "400",
                          color: active ? colors.background : colors.textSecondary,
                        }}
                      >
                        {t(`status.${value}`)}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>
        </View>

        {ai?.notes ? (
          <View
            style={[
              styles.notesCard,
              { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder },
            ]}
          >
            <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
              {t("confirm.aiNotes")}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, textAlign: "left" }}>
              {ai.notes}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.locationCard,
            { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder },
          ]}
        >
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
              {t("item.storageLocation")}
            </Text>
            <TextInput
              value={storageLocation}
              onChangeText={setStorageLocation}
              placeholder={t("item.storagePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={[styles.rowInput, { color: colors.textPrimary }]}
            />
          </View>
        </View>
      </ScrollView>
      <GlassActionBar
        actions={[
          { label: t("confirm.save"), onPress: save, variant: "primary" },
          { label: t("confirm.retake"), onPress: retake },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  loadingPhoto: {
    width: 180,
    height: 180,
    borderRadius: radius.card,
  },
  glowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 68,
    gap: spacing.md,
    // clears the floating glass save capsule
    paddingBottom: GLASS_ACTION_BAR_INSET,
  },
  title: {
    fontSize: typography.sizes.largeTitle,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "left",
  },
  subtitle: {
    fontSize: typography.sizes.secondary,
    marginTop: -spacing.md + 2,
    textAlign: "left",
  },
  hero: {
    height: 180,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroBadge: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm + 1,
    paddingVertical: spacing.xs,
  },
  heroBadgeText: {
    fontSize: 11,
    color: photoOverlay.text,
  },
  // G03: one translucent card holds the identified fields
  fieldCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowInput: {
    flex: 1,
    fontSize: typography.sizes.body,
    textAlign: "right",
    padding: 0,
  },
  ltr: {
    writingDirection: "ltr",
  },
  monoInput: {
    fontFamily: typography.mono,
  },
  altRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  altChip: {
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  altLabel: {
    fontSize: 12,
    writingDirection: "ltr",
  },
  pickers: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  pickerCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pickerLabel: {
    fontSize: 12,
    textAlign: "left",
  },
  starsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  pickerHint: {
    fontSize: 11,
    textAlign: "left",
  },
  statusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  statusChip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm + 1,
    paddingVertical: spacing.xs,
  },
  notesCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  locationCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
});
