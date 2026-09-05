import { useState } from "react";
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
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import { Button, EmptyState, controls, radius, spacing, typography } from "@bitshelf/ui";
import { clerkEnabled } from "../lib/auth";
import { addPhotos, deletePhotoFiles } from "../lib/photos";
import { buildTitle } from "../lib/retro";
import { cropBox, scanShelfPhoto, type ScannedItem } from "../lib/shelf-scan";
import { newItemId, saveItem, type LocalItem, type LocalPhoto } from "../lib/store";
import { requestSync } from "../lib/sync";
import { useThemeColors } from "../lib/theme";

// Shelf scan (spec 6.3): one shelf photo, Opus detects the items, each box
// is cropped into its own photo, the user unchecks the noise and saves the
// batch with a shared storage location. Labeled Beta, behind a feature flag.

interface DetectedRow {
  key: string;
  scan: ScannedItem;
  photo: LocalPhoto;
  // a close-up taken during confirm replaces the crop (spec 6.3 step 4)
  closeUp: boolean;
  selected: boolean;
}

type Phase = "start" | "scanning" | "confirm" | "empty" | "error";

export default function ShelfScanScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  // clerkEnabled is constant for the app's lifetime, the hook order is stable
  const { getToken } = clerkEnabled
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth()
    : { getToken: async () => null };
  const [phase, setPhase] = useState<Phase>("start");
  const [rows, setRows] = useState<DetectedRow[]>([]);
  const [shelfPhoto, setShelfPhoto] = useState<LocalPhoto | null>(null);
  const [storageLocation, setStorageLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const startScan = async (source: "camera" | "library") => {
    const photos = await addPhotos(source);
    const photo = photos[0];
    if (!photo) return;
    deletePhotoFiles(photos.slice(1));
    setShelfPhoto(photo);
    setPhase("scanning");
    try {
      const items = await scanShelfPhoto(photo, getToken);
      if (items.length === 0) {
        setPhase("empty");
        return;
      }
      const detected: DetectedRow[] = [];
      for (const [index, scan] of items.entries()) {
        detected.push({
          key: `scan-${index}`,
          scan,
          photo: await cropBox(photo.uri, scan.box),
          closeUp: false,
          selected: true,
        });
      }
      setRows(detected);
      setPhase("confirm");
    } catch {
      setPhase("error");
    }
  };

  const toggleRow = (key: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, selected: !row.selected } : row,
      ),
    );
  };

  const retakeRow = async (key: string) => {
    const photos = await addPhotos("camera");
    const photo = photos[0];
    if (!photo) return;
    deletePhotoFiles(photos.slice(1));
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        deletePhotoFiles([row.photo]);
        return { ...row, photo, closeUp: true };
      }),
    );
  };

  const selectedCount = rows.filter((row) => row.selected).length;

  const saveAll = () => {
    if (saving || selectedCount === 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    for (const row of rows) {
      if (!row.selected) {
        deletePhotoFiles([row.photo]);
        continue;
      }
      const attributes: Record<string, unknown> = {
        ...row.scan.attributes,
        working_status: "untested",
      };
      const item: LocalItem = {
        id: newItemId(),
        category: row.scan.category,
        title: buildTitle(row.scan.category, attributes, row.scan.title),
        attributes,
        conditionGrade: null,
        conditionNotes: null,
        storageLocation: storageLocation.trim() || null,
        notes: null,
        purchasePrice: null,
        purchaseCurrency: null,
        purchaseSource: null,
        isPrivate: true,
        isFavorite: false,
        // close-ups already replaced the crop, the rest stay marked (spec 6.3)
        tags: row.closeUp ? [] : ["from_scan"],
        photos: [{ ...row.photo, isPrimary: true }],
        createdAt: now,
        updatedAt: now,
        synced: false,
      };
      saveItem(item);
    }
    if (shelfPhoto) deletePhotoFiles([shelfPhoto]);
    requestSync();
    Alert.alert(t("shelfScan.savedTitle", { count: selectedCount }), "", [
      { text: t("shelfScan.done"), onPress: () => router.back() },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${t("shelfScan.title")}  ·  Beta`,
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {phase === "start" ? (
          <View style={styles.start}>
            <Text style={[styles.explain, { color: colors.textPrimary }]}>
              {t("shelfScan.explain")}
            </Text>
            <Text style={[styles.limits, { color: colors.textSecondary }]}>
              {t("shelfScan.limits")}
            </Text>
            <Button
              label={t("item.takePhoto")}
              onPress={() => void startScan("camera")}
              colors={colors}
            />
            <Button
              label={t("item.fromLibrary")}
              onPress={() => void startScan("library")}
              colors={colors}
              variant="secondary"
            />
          </View>
        ) : phase === "scanning" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={[styles.scanning, { color: colors.textSecondary }]}>
              {t("shelfScan.scanning")}
            </Text>
          </View>
        ) : phase === "confirm" ? (
          <>
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {t("shelfScan.found", { count: rows.length })}
              {"  ·  "}
              {t("gallery.selectedCount", { count: selectedCount })}
            </Text>
            <ScrollView contentContainerStyle={styles.list}>
              {rows.map((row) => (
                <View
                  key={row.key}
                  style={[
                    styles.row,
                    { backgroundColor: colors.surface },
                    !row.selected && styles.rowOff,
                  ]}
                >
                  <Pressable onPress={() => toggleRow(row.key)} style={styles.rowMain}>
                    <View
                      style={[
                        styles.check,
                        {
                          borderColor: colors.accent,
                          backgroundColor: row.selected ? colors.accent : "transparent",
                        },
                      ]}
                    >
                      {row.selected ? (
                        <Text style={[styles.checkMark, { color: colors.onAccent }]}>
                          {"✓"}
                        </Text>
                      ) : null}
                    </View>
                    <Image
                      source={{ uri: row.photo.thumbUri }}
                      style={[styles.thumb, { backgroundColor: colors.surface2 }]}
                      contentFit="cover"
                    />
                    <View style={styles.rowBody}>
                      <Text
                        numberOfLines={1}
                        style={[styles.rowTitle, { color: colors.textPrimary }]}
                      >
                        {row.scan.title}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                        {`${Math.round(row.scan.confidence * 100)}%`}
                        {row.closeUp ? `  ·  ${t("shelfScan.closeUpTaken")}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => retakeRow(row.key)}
                    style={({ pressed }) => [
                      styles.retake,
                      { backgroundColor: pressed ? colors.surface2 : "transparent" },
                    ]}
                  >
                    <Text style={[styles.retakeLabel, { color: colors.accent }]}>
                      {t("shelfScan.closeUp")}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <View style={styles.footer}>
              <TextInput
                value={storageLocation}
                onChangeText={setStorageLocation}
                placeholder={t("shelfScan.sharedLocation")}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, color: colors.textPrimary },
                ]}
              />
              <Button
                label={t("shelfScan.saveAll", { count: selectedCount })}
                onPress={saveAll}
                colors={colors}
                disabled={selectedCount === 0 || saving}
              />
            </View>
          </>
        ) : (
          <View style={styles.center}>
            <EmptyState
              title={
                phase === "empty" ? t("shelfScan.nothingFound") : t("shelfScan.failed")
              }
              colors={colors}
            />
            <Button
              label={t("confirm.retry")}
              onPress={() => setPhase("start")}
              colors={colors}
              variant="secondary"
              style={styles.retry}
            />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  start: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  explain: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
    textAlign: "left",
  },
  limits: {
    fontSize: typography.sizes.secondary,
    lineHeight: 20,
    textAlign: "left",
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  scanning: {
    fontSize: typography.sizes.secondary,
  },
  count: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  row: {
    borderRadius: radius.card,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowOff: {
    opacity: 0.45,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 13,
    fontWeight: "700",
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.tag,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: typography.sizes.secondary + 1,
    fontWeight: "600",
    writingDirection: "ltr",
    textAlign: "left",
  },
  // mixes a percentage with Hebrew, stays in the UI font
  rowMeta: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
  },
  retake: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.tag,
  },
  retakeLabel: {
    fontSize: typography.sizes.caption + 1,
    fontWeight: "600",
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  input: {
    height: controls.buttonHeight - 6,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.secondary + 1,
    // TextInput alignment is physical on iOS, right hugs the RTL start
    textAlign: "right",
  },
  retry: {
    alignSelf: "stretch",
  },
});
