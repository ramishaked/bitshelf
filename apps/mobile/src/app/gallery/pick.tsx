import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { EmptyState, radius, spacing, typography } from "@bitshelf/ui";
import {
  GLASS_ACTION_BAR_INSET,
  GlassActionBar,
} from "../../components/glass-action-bar";
import {
  addItemToGallery,
  galleryItemCount,
  listGalleries,
  listGalleryItemIds,
  removeItemFromGallery,
  touchGallery,
  type LocalGallery,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors } from "../../lib/theme";

// "Add to gallery" from the collection long press (spec 7.1). Tap toggles
// membership, so the same screen also removes.
export default function GalleryPickScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  // accepts one id or a comma list (multi-select from the collection wall)
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const itemIds = (itemId ?? "").split(",").filter(Boolean);
  const [galleries, setGalleries] = useState<LocalGallery[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    const all = listGalleries();
    setGalleries(all);
    if (itemIds.length > 0) {
      setMemberOf(
        new Set(
          all
            .filter((g) => {
              const inGallery = listGalleryItemIds(g.id);
              return itemIds.every((id) => inGallery.includes(id));
            })
            .map((g) => g.id),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  useFocusEffect(reload);

  const toggle = (gallery: LocalGallery) => {
    if (itemIds.length === 0) return;
    for (const id of itemIds) {
      if (memberOf.has(gallery.id)) {
        removeItemFromGallery(gallery.id, id);
      } else {
        addItemToGallery(gallery.id, id);
      }
    }
    touchGallery(gallery.id);
    reload();
    requestSync();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("gallery.pickTitle"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {galleries.length === 0 ? (
          <EmptyState title={t("gallery.pickEmpty")} colors={colors} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {galleries.map((gallery) => {
              const inGallery = memberOf.has(gallery.id);
              return (
                <Pressable
                  key={gallery.id}
                  onPress={() => toggle(gallery)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? colors.surface2 : colors.surface },
                    inGallery && { borderWidth: 1, borderColor: colors.accent },
                  ]}
                >
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                    {lang === "en" && gallery.nameEn ? gallery.nameEn : gallery.nameHe}
                  </Text>
                  <Text style={[styles.rowMeta, { color: inGallery ? colors.accent : colors.textSecondary }]}>
                    {inGallery ? "✓" : galleryItemCount(gallery.id)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <Pressable
          onPress={() =>
            // carry the picked items into the new gallery form, preselected
            router.push(
              itemIds.length > 0
                ? `/gallery/new?itemIds=${encodeURIComponent(itemIds.join(","))}`
                : "/gallery/new",
            )
          }
          style={({ pressed }) => [
            styles.createRow,
            { backgroundColor: pressed ? colors.surface2 : colors.surface },
          ]}
        >
          <Text style={[styles.createLabel, { color: colors.accent }]}>
            {`+ ${t("galleries.create")}`}
          </Text>
        </Pressable>
        {/* membership is applied on tap; this just closes (Rami: there was
            no way forward after picking a gallery) */}
        <GlassActionBar
          actions={[
            { label: t("gallery.done"), onPress: () => router.back(), variant: "primary" },
          ]}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowTitle: {
    fontSize: typography.sizes.body,
    textAlign: "left",
  },
  rowMeta: {
    fontFamily: typography.mono,
    fontSize: typography.sizes.secondary,
  },
  createRow: {
    margin: spacing.lg,
    // clears the floating done pill
    marginBottom: GLASS_ACTION_BAR_INSET,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  createLabel: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
});
