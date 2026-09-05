import { useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  controls,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from "@bitshelf/ui";
import {
  applyMapsTo,
  buildTitle,
  categories,
  conditionLabels,
  fieldsForCategory,
  isLatinField,
  type AttributeField,
} from "../../lib/retro";
import { addPhotos, deletePhotoFiles } from "../../lib/photos";
import {
  getItem,
  newItemId,
  saveItem,
  type LocalItem,
  type LocalPhoto,
} from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

function SectionLabel({ text, colors }: { text: string; colors: ThemeColors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{text}</Text>
  );
}

function Chip({
  label,
  selected,
  onPress,
  colors,
  ltr = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
  ltr?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.accentPressed : colors.surface },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.onAccent : colors.textSecondary },
          ltr && styles.ltr,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ItemFormScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getItem(id) : null), [id]);

  const [category, setCategory] = useState(existing?.category ?? "computer");
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (existing) {
      for (const [k, v] of Object.entries(existing.attributes)) {
        if (v != null) out[k] = String(v);
      }
    }
    return out;
  });
  const [conditionGrade, setConditionGrade] = useState<number | null>(
    existing?.conditionGrade ?? null,
  );
  const [storageLocation, setStorageLocation] = useState(existing?.storageLocation ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [purchasePrice, setPurchasePrice] = useState(existing?.purchasePrice ?? "");
  const [purchaseCurrency, setPurchaseCurrency] = useState<"ILS" | "USD">(
    existing?.purchaseCurrency ?? "ILS",
  );
  const [purchaseSource, setPurchaseSource] = useState(existing?.purchaseSource ?? "");
  const [isPrivate, setIsPrivate] = useState(existing?.isPrivate ?? true);
  const [photos, setPhotos] = useState<LocalPhoto[]>(existing?.photos ?? []);
  // photos added in this session, deleted from disk on cancel
  const sessionPhotos = useRef<LocalPhoto[]>([]);
  const removedPhotos = useRef<LocalPhoto[]>([]);

  const fields = fieldsForCategory(category);

  const setAttr = (key: string, value: string) =>
    setAttrs((prev) => ({ ...prev, [key]: value }));

  const onAddPhotos = async (source: "camera" | "library") => {
    const added = await addPhotos(source);
    if (added.length) {
      sessionPhotos.current.push(...added);
      setPhotos((prev) => [...prev, ...added]);
    }
  };

  const removePhoto = (photo: LocalPhoto) => {
    removedPhotos.current.push(photo);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const cancel = () => {
    deletePhotoFiles(sessionPhotos.current);
    router.back();
  };

  const save = () => {
    const cleanAttrs: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = attrs[field.key]?.trim();
      if (!raw) continue;
      cleanAttrs[field.key] =
        field.type === "int" || field.type === "decimal" ? Number(raw) : raw;
    }
    const finalAttrs = applyMapsTo(category, cleanAttrs);
    const now = new Date().toISOString();
    const withPrimary = photos.map((p, i) => ({ ...p, isPrimary: i === 0 }));
    const item: LocalItem = {
      id: existing?.id ?? newItemId(),
      category,
      title: buildTitle(category, finalAttrs, t("item.untitled")),
      attributes: finalAttrs,
      conditionGrade,
      storageLocation: storageLocation.trim() || null,
      notes: notes.trim() || null,
      purchasePrice: purchasePrice.trim() || null,
      purchaseCurrency: purchasePrice.trim() ? purchaseCurrency : null,
      purchaseSource: purchaseSource.trim() || null,
      isPrivate,
      isFavorite: existing?.isFavorite ?? false,
      photos: withPrimary,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      synced: false,
    };
    saveItem(item);
    deletePhotoFiles(removedPhotos.current);
    router.back();
  };

  const enumLabel = (field: AttributeField, value: string): string => {
    if (field.key === "working_status") return t(`status.${value}`);
    if (field.key === "completeness") return t(`completeness.${value}`);
    if (field.key === "media_type") return t(`media.${value}`);
    return value;
  };

  const renderField = (field: AttributeField) => {
    if (field.key === "description") {
      return null; // AI fills it in week 3, no manual field for now
    }
    if (field.type === "enum") {
      return (
        <View key={field.key} style={styles.fieldBlock}>
          <SectionLabel text={field.label[lang]} colors={colors} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {(field.enum_values ?? []).map((value) => (
                <Chip
                  key={value}
                  label={enumLabel(field, value)}
                  selected={attrs[field.key] === value}
                  onPress={() =>
                    setAttr(field.key, attrs[field.key] === value ? "" : value)
                  }
                  colors={colors}
                  ltr={isLatinField(field.key)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }
    const ltr = isLatinField(field.key) || field.type === "int";
    return (
      <View key={field.key} style={styles.fieldBlock}>
        <SectionLabel text={field.label[lang]} colors={colors} />
        <TextInput
          value={attrs[field.key] ?? ""}
          onChangeText={(v) => setAttr(field.key, v)}
          keyboardType={field.type === "int" ? "number-pad" : "default"}
          autoCapitalize={ltr ? "none" : "sentences"}
          autoCorrect={!ltr}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.textPrimary },
            ltr && styles.ltrInput,
          ]}
        />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: existing ? t("item.editTitle") : t("item.newTitle"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerLeft: () => (
            <Pressable onPress={cancel}>
              <Text style={{ color: colors.accent, fontSize: typography.sizes.body }}>
                {t("item.cancel")}
              </Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <SectionLabel text={t("item.photos")} colors={colors} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photosRow}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoWrap}>
                  <Image source={{ uri: photo.thumbUri }} style={styles.photo} />
                  <Pressable
                    onPress={() => removePhoto(photo)}
                    style={[styles.photoRemove, { backgroundColor: colors.surface2 }]}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 11 }}>×</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => void onAddPhotos("camera")}
                style={[styles.photoAdd, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.photoAddLabel, { color: colors.accent }]}>
                  {t("item.takePhoto")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void onAddPhotos("library")}
                style={[styles.photoAdd, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.photoAddLabel, { color: colors.accent }]}>
                  {t("item.fromLibrary")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <SectionLabel text={t("item.category")} colors={colors} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {categories.map((c) => (
                <Chip
                  key={c.slug}
                  label={c.name[lang]}
                  selected={category === c.slug}
                  onPress={() => setCategory(c.slug)}
                  colors={colors}
                />
              ))}
            </View>
          </ScrollView>

          {fields.map(renderField)}

          <View style={styles.fieldBlock}>
            <SectionLabel text={t("item.conditionGrade")} colors={colors} />
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((grade) => (
                <Pressable
                  key={grade}
                  onPress={() =>
                    setConditionGrade(conditionGrade === grade ? null : grade)
                  }
                  style={styles.star}
                >
                  <Text
                    style={{
                      fontSize: 26,
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
              {conditionGrade != null ? (
                <Text style={[styles.starLabel, { color: colors.textSecondary }]}>
                  {conditionLabels[String(conditionGrade)]?.[lang]}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <SectionLabel text={t("item.storageLocation")} colors={colors} />
            <TextInput
              value={storageLocation}
              onChangeText={setStorageLocation}
              placeholder={t("item.storagePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.textPrimary },
              ]}
            />
          </View>

          <View style={styles.fieldBlock}>
            <SectionLabel text={t("item.purchaseSection")} colors={colors} />
            <View style={styles.purchaseRow}>
              <TextInput
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                placeholder={t("item.purchasePrice")}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  styles.priceInput,
                  { backgroundColor: colors.surface, color: colors.textPrimary },
                ]}
              />
              <Chip
                label="₪"
                selected={purchaseCurrency === "ILS"}
                onPress={() => setPurchaseCurrency("ILS")}
                colors={colors}
              />
              <Chip
                label="$"
                selected={purchaseCurrency === "USD"}
                onPress={() => setPurchaseCurrency("USD")}
                colors={colors}
              />
              <TextInput
                value={purchaseSource}
                onChangeText={setPurchaseSource}
                placeholder={t("item.purchaseSource")}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  styles.sourceInput,
                  { backgroundColor: colors.surface, color: colors.textPrimary },
                ]}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <SectionLabel text={t("item.notes")} colors={colors} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                styles.notesInput,
                { backgroundColor: colors.surface, color: colors.textPrimary },
              ]}
            />
          </View>

          <View style={styles.privateRow}>
            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body }}>
              {t("item.isPrivate")}
            </Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: colors.accentPressed, false: colors.surface2 }}
            />
          </View>

          <Pressable
            onPress={save}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: pressed ? colors.accentPressed : colors.accent },
            ]}
          >
            <Text style={[styles.saveLabel, { color: colors.onAccent }]}>
              {t("item.save")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.md,
  },
  photosRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  photoWrap: {
    position: "relative",
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: radius.tag,
  },
  photoRemove: {
    position: "absolute",
    top: 2,
    end: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: radius.tag,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xs,
  },
  photoAddLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm - 2,
  },
  chip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipLabel: {
    fontSize: 13,
  },
  fieldBlock: {
    marginTop: spacing.xs,
  },
  input: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    fontSize: typography.sizes.body,
  },
  ltr: {
    writingDirection: "ltr",
  },
  ltrInput: {
    textAlign: "left",
    writingDirection: "ltr",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  star: {
    padding: 2,
  },
  starLabel: {
    fontSize: 13,
    marginStart: spacing.sm,
  },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm - 2,
  },
  priceInput: {
    flex: 1,
  },
  sourceInput: {
    flex: 1.4,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  privateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  saveButton: {
    marginTop: spacing.xl,
    height: controls.buttonHeight,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  saveLabel: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
});
