import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { controls, radius, spacing, typography } from "@bitshelf/ui";
import { ItemGrid } from "../../components/item-grid";
import {
  getGallery,
  listGalleryItemIds,
  listItems,
  newItemId,
  saveGallery,
  setGalleryItems,
  type LocalGallery,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors } from "../../lib/theme";

// Create or edit a gallery (spec 7.3): bilingual name, then multi-select
// from the collection. Nothing blocks saving except an empty Hebrew name.
export default function GalleryFormScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getGallery(id) : null), [id]);

  const [nameHe, setNameHe] = useState(existing?.nameHe ?? "");
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const items = useMemo(() => listItems(), []);

  useEffect(() => {
    if (id) setSelected(new Set(listGalleryItemIds(id)));
  }, [id]);

  const canSave = nameHe.trim().length > 0 || nameEn.trim().length > 0;

  const save = () => {
    const now = new Date().toISOString();
    const gallery: LocalGallery = existing
      ? {
          ...existing,
          nameHe: nameHe.trim(),
          nameEn: nameEn.trim() || null,
          updatedAt: now,
          synced: false,
        }
      : {
          id: newItemId(),
          nameHe: nameHe.trim(),
          nameEn: nameEn.trim() || null,
          descriptionHe: null,
          visibility: "private",
          publicSlug: null,
          showValue: false,
          createdAt: now,
          updatedAt: now,
          synced: false,
        };
    saveGallery(gallery);
    // keep existing manual order for items that were already members
    const keptOrder = existing ? listGalleryItemIds(gallery.id) : [];
    const ordered = [
      ...keptOrder.filter((itemId) => selected.has(itemId)),
      ...items
        .map((i) => i.id)
        .filter((itemId) => selected.has(itemId) && !keptOrder.includes(itemId)),
    ];
    setGalleryItems(gallery.id, ordered);
    requestSync();
    if (existing) {
      router.back();
    } else {
      router.replace(`/gallery/${gallery.id}`);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: existing ? t("gallery.editTitle") : t("gallery.newTitle"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.form}>
          <TextInput
            value={nameHe}
            onChangeText={setNameHe}
            placeholder={t("gallery.nameHe")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
          <TextInput
            value={nameEn}
            onChangeText={setNameEn}
            placeholder={t("gallery.nameEn")}
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            style={[
              styles.input,
              styles.latinInput,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
          <Text style={[styles.pickLabel, { color: colors.textSecondary }]}>
            {`${t("gallery.pickItems")}  ·  ${t("gallery.selectedCount", { count: selected.size })}`}
          </Text>
        </View>
        <ItemGrid
          items={items}
          selectedIds={selected}
          onPressItem={(item) => {
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(item.id)) {
                next.delete(item.id);
              } else {
                next.add(item.id);
              }
              return next;
            });
          }}
        />
        <Pressable
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
              opacity: canSave ? 1 : 0.4,
            },
          ]}
        >
          <Text style={[styles.saveLabel, { color: colors.onAccent }]}>
            {t("gallery.save")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  form: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  input: {
    height: controls.buttonHeight - 4,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    // TextInput alignment is physical on iOS, right hugs the RTL start
    textAlign: "right",
  },
  // no mono here: the placeholder is Hebrew and Menlo has no Hebrew glyphs
  latinInput: {
    writingDirection: "ltr",
  },
  pickLabel: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
    marginTop: spacing.xs,
  },
  save: {
    position: "absolute",
    bottom: 28,
    start: spacing.lg,
    end: spacing.lg,
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
