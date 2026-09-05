import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  grid,
  photoOverlay,
  radius,
  typography,
  type ThemeColors,
} from "@bitshelf/ui";
import { ScreenHeader } from "../../components/screen-header";
import { clerkEnabled } from "../../lib/auth";
import { statusColor } from "../../lib/retro";
import { listItems, type LocalItem } from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

// Photo tiles per the approved design: square, status dot top-right, lock
// glyph when private, item name in monospace over a bottom gradient.
function ItemTile({
  item,
  colors,
  size,
}: {
  item: LocalItem;
  colors: ThemeColors;
  size: number;
}) {
  const router = useRouter();
  const primary =
    item.photos.find((p) => p.isPrimary) ?? item.photos[0] ?? null;
  const workingStatus = item.attributes.working_status as string | undefined;

  return (
    <Pressable
      onPress={() => router.push(`/item/${item.id}`)}
      style={[styles.tile, { backgroundColor: colors.surface, width: size, height: size }]}
    >
      {primary ? (
        <Image
          source={{ uri: primary.thumbUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      <View style={[styles.dot, { backgroundColor: statusColor(workingStatus, colors) }]} />
      <LinearGradient
        colors={[photoOverlay.gradientStart, photoOverlay.gradientEnd]}
        style={styles.nameBar}
      >
        <Text numberOfLines={1} style={styles.name}>
          {item.title}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export default function CollectionScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((width - grid.gap * (grid.columns + 1)) / grid.columns);
  const [items, setItems] = useState<LocalItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setItems(listItems());
    }, []),
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("collection.title")} />
      {items.length === 0 ? (
        <EmptyState title={t("collection.emptyTitle")} colors={colors} showLogo />
      ) : (
        // the photo wall flows LTR like the design, latin names read naturally
        <View style={styles.gridWrap}>
          <FlashList
            data={items}
            numColumns={grid.columns}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItemTile item={item} colors={colors} size={tileSize} />
            )}
            contentContainerStyle={styles.grid}
          />
        </View>
      )}
      <Pressable
        onPress={() => {
          // spec 7.1: photograph / manual add (shelf scan arrives in week 5).
          // AI capture needs a signed-in session for the server call.
          if (!clerkEnabled) {
            router.push("/item/new");
            return;
          }
          Alert.alert(t("item.newTitle"), "", [
            { text: t("fab.capture"), onPress: () => router.push("/capture") },
            { text: t("fab.manual"), onPress: () => router.push("/item/new") },
            { text: t("item.cancel"), style: "cancel" },
          ]);
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? colors.accentPressed : colors.accent,
            shadowColor: colors.accent,
          },
        ]}
      >
        <Text style={[styles.fabPlus, { color: colors.onAccent }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  gridWrap: {
    flex: 1,
    direction: "ltr",
  },
  grid: {
    padding: grid.gap,
  },
  tile: {
    margin: grid.gap / 2,
    overflow: "hidden",
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
  fab: {
    position: "absolute",
    bottom: 24,
    end: 20,
    width: 56,
    height: 56,
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fabPlus: {
    fontSize: 30,
    fontWeight: "600",
    marginTop: -2,
  },
});
