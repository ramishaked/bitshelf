import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { grid, photoOverlay, spacing, typography } from "@bitshelf/ui";
import { statusColor } from "../../lib/retro";
import { useThemeColors } from "../../lib/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

interface PublicItem {
  id: string;
  title: string;
  workingStatus: string | null;
  photos: { url: string; thumbUrl: string | null; isPrimary: boolean }[];
}

interface PublicGallery {
  name: { he?: string; en?: string };
  description: { he?: string } | null;
  itemCount: number;
  items: PublicItem[];
}

// Public gallery viewer, the only route guests can reach (spec 3). Read
// only: remote thumbnails, no local cache.
export default function PublicGalleryScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "notFound" | "error" | "ready">(
    "loading",
  );
  const [gallery, setGallery] = useState<PublicGallery | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/g/${slug}`);
        if (cancelled) return;
        if (response.status === 404) {
          setState("notFound");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }
        setGallery((await response.json()) as PublicGallery);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const tileSize = Math.floor((width - grid.gap * (grid.columns + 1)) / grid.columns);
  const title =
    (lang === "en" ? gallery?.name.en : gallery?.name.he) ??
    gallery?.name.he ??
    gallery?.name.en ??
    t("publicGallery.title");

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {state === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : state === "ready" && gallery ? (
          <>
            <ScrollView style={styles.meta} scrollEnabled={false}>
              {gallery.description?.he ? (
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {gallery.description.he}
                </Text>
              ) : null}
              <Text style={[styles.count, { color: colors.textSecondary }]}>
                {t("publicGallery.itemCount", { count: gallery.itemCount })}
              </Text>
            </ScrollView>
            <View style={styles.gridWrap}>
              <FlashList
                data={gallery.items}
                numColumns={grid.columns}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const photo =
                    item.photos.find((p) => p.isPrimary) ?? item.photos[0] ?? null;
                  return (
                    <View
                      style={[
                        styles.tile,
                        { backgroundColor: colors.surface, width: tileSize, height: tileSize },
                      ]}
                    >
                      {photo ? (
                        <Image
                          source={{ uri: photo.thumbUrl ?? photo.url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : null}
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: statusColor(
                              item.workingStatus ?? undefined,
                              colors,
                            ),
                          },
                        ]}
                      />
                      <LinearGradient
                        colors={[photoOverlay.gradientStart, photoOverlay.gradientEnd]}
                        style={styles.nameBar}
                      >
                        <Text numberOfLines={1} style={styles.name}>
                          {item.title}
                        </Text>
                      </LinearGradient>
                    </View>
                  );
                }}
                contentContainerStyle={{ padding: grid.gap }}
              />
            </View>
          </>
        ) : (
          <View style={styles.center}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {state === "notFound"
                ? t("publicGallery.notFound")
                : t("publicGallery.loadError")}
            </Text>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  message: {
    fontSize: typography.sizes.secondary,
    textAlign: "center",
  },
  meta: {
    flexGrow: 0,
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingVertical: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.secondary,
    textAlign: "left",
    marginBottom: spacing.xs,
  },
  count: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
  },
  gridWrap: {
    flex: 1,
    direction: "ltr",
    transform: [{ scaleX: -1 }],
  },
  tile: {
    margin: grid.gap / 2,
    overflow: "hidden",
    transform: [{ scaleX: -1 }],
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 1,
  },
  nameBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 22,
    paddingHorizontal: 6,
    paddingBottom: 5,
  },
  name: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: photoOverlay.text,
    textAlign: "left",
    writingDirection: "ltr",
  },
});
