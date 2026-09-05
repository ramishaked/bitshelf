import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { EmptyState, controls, radius, spacing, typography } from "@bitshelf/ui";
import { ItemGrid } from "../../components/item-grid";
import { makeSlug, publicGalleryUrl } from "../../lib/gallery-link";
import {
  deleteGallery,
  getGallery,
  listGalleryItems,
  removeItemFromGallery,
  saveGallery,
  touchGallery,
  type LocalGallery,
  type LocalItem,
} from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors } from "../../lib/theme";

// Gallery screen (spec 7.3): a reduced collection screen plus sharing.
// The public link only works after the gallery syncs to the server.
export default function GalleryScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gallery, setGallery] = useState<LocalGallery | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);

  const reload = useCallback(() => {
    if (!id) return;
    setGallery(getGallery(id));
    setItems(listGalleryItems(id));
  }, [id]);
  useFocusEffect(reload);

  if (!gallery) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  const title = lang === "en" && gallery.nameEn ? gallery.nameEn : gallery.nameHe;
  const isPublic = gallery.visibility === "public_link" && gallery.publicSlug;

  const shareLink = async () => {
    let slug = gallery.publicSlug;
    if (!isPublic) {
      slug = makeSlug(gallery.nameEn);
      saveGallery({
        ...gallery,
        visibility: "public_link",
        publicSlug: slug,
        updatedAt: new Date().toISOString(),
        synced: false,
      });
      reload();
      requestSync();
    }
    await Share.share({ message: publicGalleryUrl(slug as string) });
  };

  const revokeLink = () => {
    Alert.alert(t("gallery.revokeConfirmTitle"), t("gallery.revokeConfirmBody"), [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("gallery.revoke"),
        style: "destructive",
        onPress: () => {
          saveGallery({
            ...gallery,
            visibility: "private",
            publicSlug: null,
            updatedAt: new Date().toISOString(),
            synced: false,
          });
          reload();
          requestSync();
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(t("gallery.deleteConfirmTitle"), t("gallery.deleteConfirmBody"), [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("item.delete"),
        style: "destructive",
        onPress: () => {
          deleteGallery(gallery.id);
          router.back();
        },
      },
    ]);
  };

  const removeItem = (item: LocalItem) => {
    Alert.alert(item.title, "", [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("gallery.remove"),
        style: "destructive",
        onPress: () => {
          removeItemFromGallery(gallery.id, item.id);
          touchGallery(gallery.id);
          reload();
          requestSync();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.meta}>
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {t("gallery.itemCount", { count: items.length })}
            {"  ·  "}
            {isPublic ? t("gallery.visibilityPublic") : t("gallery.visibilityPrivate")}
          </Text>
          {isPublic ? (
            <Text
              numberOfLines={1}
              style={[styles.link, { color: colors.accent }]}
            >
              {publicGalleryUrl(gallery.publicSlug as string)}
            </Text>
          ) : null}
          {isPublic && !gallery.synced ? (
            <Text style={[styles.count, { color: colors.statusPartiallyWorking }]}>
              {t("gallery.notSynced")}
            </Text>
          ) : null}
        </View>
        {items.length === 0 ? (
          <EmptyState title={t("gallery.empty")} colors={colors} />
        ) : (
          <ItemGrid items={items} onLongPressItem={removeItem} />
        )}
        <View style={styles.actions}>
          <Pressable
            onPress={shareLink}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: pressed ? colors.accentPressed : colors.accent },
            ]}
          >
            <Text style={[styles.actionLabel, { color: colors.onAccent }]}>
              {t("gallery.share")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/gallery/new?id=${gallery.id}`)}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: pressed ? colors.surface2 : colors.surface },
            ]}
          >
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {t("gallery.edit")}
            </Text>
          </Pressable>
          {isPublic ? (
            <Pressable
              onPress={revokeLink}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: pressed ? colors.surface2 : colors.surface },
              ]}
            >
              <Text style={[styles.actionLabel, { color: colors.statusPartiallyWorking }]}>
                {t("gallery.revoke")}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: pressed ? colors.surface2 : colors.surface },
              ]}
            >
              <Text style={[styles.actionLabel, { color: colors.statusNotWorking }]}>
                {t("item.delete")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  meta: {
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  count: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
  },
  link: {
    fontSize: typography.sizes.caption + 1,
    fontFamily: typography.mono,
    textAlign: "left",
    writingDirection: "ltr",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  action: {
    flex: 1,
    height: controls.buttonHeight,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: typography.sizes.secondary + 1,
    fontWeight: "600",
  },
});
