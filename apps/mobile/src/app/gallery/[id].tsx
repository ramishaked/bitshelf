import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import { EmptyState, photoOverlay, radius, spacing, typography } from "@bitshelf/ui";
import {
  GLASS_ACTION_BAR_INSET,
  GlassActionBar,
} from "../../components/glass-action-bar";
import { ItemGrid } from "../../components/item-grid";
import { clerkEnabled } from "../../lib/auth";
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
import { requestSync, syncNow } from "../../lib/sync";
import { useThemeColors } from "../../lib/theme";

// round glass icon button with a caption, for the shared-gallery actions
function IconAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconAction}>
      <View style={[styles.iconCircle, { borderColor: photoOverlay.glassBorder }]}>
        <SymbolView name={icon} size={22} tintColor={color} />
      </View>
      <Text style={[styles.iconLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

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
  const [syncing, setSyncing] = useState(false);
  // clerkEnabled is constant for the app's lifetime, the hook order is stable
  const { getToken } = clerkEnabled
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth()
    : { getToken: async () => null };

  const reload = useCallback(() => {
    if (!id) return;
    setGallery(getGallery(id));
    setItems(listGalleryItems(id));
  }, [id]);
  useFocusEffect(reload);

  // force a sync from here and report the outcome, so a stuck public link is
  // not a silent dead-end (Rami: the link showed "not synced" forever)
  const syncNowFromHere = async () => {
    if (!clerkEnabled) {
      Alert.alert(t("gallery.syncNeedsAccount"));
      return;
    }
    setSyncing(true);
    try {
      await syncNow(getToken);
      reload();
      const fresh = id ? getGallery(id) : null;
      if (fresh && !fresh.synced) Alert.alert(t("gallery.syncFailed"));
    } catch {
      Alert.alert(t("gallery.syncFailed"));
    } finally {
      setSyncing(false);
    }
  };

  if (!gallery) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  const title = lang === "en" && gallery.nameEn ? gallery.nameEn : gallery.nameHe;
  const isPublic = gallery.visibility === "public_link" && gallery.publicSlug;

  // publish makes the gallery public and syncs immediately, so by the time
  // it reads "published" the link already works. The slug is permanent once
  // assigned, so re-publishing after a revoke keeps the SAME link.
  const publishGallery = async () => {
    if (isPublic) return;
    saveGallery({
      ...gallery,
      visibility: "public_link",
      publicSlug: gallery.publicSlug ?? makeSlug(gallery.nameEn),
      updatedAt: new Date().toISOString(),
      synced: false,
    });
    reload();
    if (!clerkEnabled) {
      requestSync();
      return;
    }
    setSyncing(true);
    try {
      await syncNow(getToken);
      reload();
    } catch {
      // stays unsynced; the fallback row lets the user retry
    } finally {
      setSyncing(false);
    }
  };

  // share is offered only after publishing, from the published card
  const shareLink = async () => {
    if (!gallery.publicSlug) return;
    await Share.share({ message: publicGalleryUrl(gallery.publicSlug) });
  };

  const revokeLink = () => {
    Alert.alert(t("gallery.revokeConfirmTitle"), t("gallery.revokeConfirmBody"), [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("gallery.revoke"),
        style: "destructive",
        onPress: () => {
          // keep the slug so re-sharing revives the same link; only the
          // visibility flips, which makes the public page 404 meanwhile
          saveGallery({
            ...gallery,
            visibility: "private",
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
          </Text>

          {isPublic ? (
            // shared state: a clear badge and round icon actions, no raw URL
            gallery.synced ? (
              <View style={styles.sharedCard}>
                <View style={styles.sharedHead}>
                  <View style={[styles.sharedDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.sharedLabel, { color: colors.textPrimary }]}>
                    {t("gallery.sharedPublic")}
                  </Text>
                </View>
                <View style={styles.sharedActions}>
                  <IconAction
                    icon="safari"
                    label={t("gallery.openInBrowser")}
                    color={colors.accent}
                    onPress={() =>
                      void Linking.openURL(publicGalleryUrl(gallery.publicSlug as string))
                    }
                  />
                  <IconAction
                    icon="doc.on.doc"
                    label={t("gallery.copyLink")}
                    color={colors.textPrimary}
                    onPress={async () => {
                      await Clipboard.setStringAsync(
                        publicGalleryUrl(gallery.publicSlug as string),
                      );
                      Alert.alert(t("gallery.linkCopied"));
                    }}
                  />
                  <IconAction
                    icon="square.and.arrow.up"
                    label={t("gallery.share")}
                    color={colors.textPrimary}
                    onPress={() => void shareLink()}
                  />
                </View>
              </View>
            ) : (
              <Pressable onPress={syncNowFromHere} style={styles.syncRow}>
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.statusPartiallyWorking} />
                ) : null}
                <Text style={[styles.count, { color: colors.statusPartiallyWorking }]}>
                  {syncing ? t("gallery.syncing") : t("gallery.notSyncedTap")}
                </Text>
              </Pressable>
            )
          ) : null}
        </View>
        {items.length === 0 ? (
          <EmptyState title={t("gallery.empty")} colors={colors} />
        ) : (
          <ItemGrid
            items={items}
            onLongPressItem={removeItem}
            bottomInset={GLASS_ACTION_BAR_INSET}
          />
        )}
        <GlassActionBar
          actions={
            isPublic
              ? [
                  {
                    label: t("gallery.edit"),
                    onPress: () => router.push(`/gallery/new?id=${gallery.id}`),
                    variant: "primary" as const,
                  },
                  { label: t("gallery.unpublish"), onPress: revokeLink, variant: "warning" as const },
                ]
              : [
                  {
                    label: syncing ? t("gallery.publishing") : t("gallery.publish"),
                    onPress: () => void publishGallery(),
                    variant: "primary" as const,
                  },
                  {
                    label: t("gallery.edit"),
                    onPress: () => router.push(`/gallery/new?id=${gallery.id}`),
                  },
                  { label: t("item.delete"), onPress: confirmDelete, variant: "destructive" as const },
                ]
          }
        />
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
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingTop: spacing.xs,
  },
  sharedCard: {
    marginTop: spacing.xs,
    gap: spacing.sm + 2,
  },
  sharedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  sharedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sharedLabel: {
    fontSize: typography.sizes.secondary,
    fontWeight: "600",
    textAlign: "left",
  },
  sharedActions: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  iconAction: {
    alignItems: "center",
    gap: spacing.xs,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLabel: {
    fontSize: typography.sizes.caption,
  },
});
