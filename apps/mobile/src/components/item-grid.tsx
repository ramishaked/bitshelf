import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  grid,
  photoOverlay,
  typography,
  type ThemeColors,
} from "@bitshelf/ui";
import { statusColor } from "../lib/retro";
import type { LocalItem } from "../lib/store";
import { useThemeColors } from "../lib/theme";

// Photo tiles per the approved design: square, status dot top-right, item
// name in monospace over a bottom gradient. Shared by the collection tab,
// favorites, and gallery screens.
function ItemTile({
  item,
  colors,
  size,
  selected,
  showName,
  onPress,
  onLongPress,
}: {
  item: LocalItem;
  colors: ThemeColors;
  size: number;
  selected?: boolean;
  showName?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const primary =
    item.photos.find((p) => p.isPrimary) ?? item.photos[0] ?? null;
  const workingStatus = item.attributes.working_status as string | undefined;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.tile,
        { backgroundColor: colors.surface, width: size, height: size },
        selected && { borderWidth: 2, borderColor: colors.accent },
      ]}
    >
      {primary ? (
        <Image
          source={{ uri: primary.thumbUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      <View style={[styles.dot, { backgroundColor: statusColor(workingStatus, colors) }]} />
      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.accent }]}>
          <Text style={[styles.checkMark, { color: colors.onAccent }]}>{"✓"}</Text>
        </View>
      ) : null}
      {showName ? (
        <LinearGradient
          colors={[photoOverlay.gradientStart, photoOverlay.gradientEnd]}
          style={styles.nameBar}
        >
          <Text numberOfLines={1} style={styles.name}>
            {item.title}
          </Text>
        </LinearGradient>
      ) : null}
    </Pressable>
  );
}

export function ItemGrid({
  items,
  selectedIds,
  onPressItem,
  onLongPressItem,
  topInset = 0,
  bottomInset = 0,
  showNames = false,
}: {
  items: LocalItem[];
  // selection mode (gallery multi-select): tiles toggle instead of navigating
  selectedIds?: Set<string>;
  onPressItem?: (item: LocalItem) => void;
  onLongPressItem?: (item: LocalItem) => void;
  // room for translucent chrome the grid scrolls under (Photos style)
  topInset?: number;
  bottomInset?: number;
  // the main wall is pure photos (handoff G01); selection screens show names
  showNames?: boolean;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((width - grid.gap * (grid.columns + 1)) / grid.columns);

  return (
    // the photo wall flows RTL (Rami, 05.09.2026). FlashList cannot lay out
    // columns in an RTL container, so the list is laid out LTR and mirrored,
    // and every tile is mirrored back.
    <View style={styles.gridWrap}>
      <FlashList
        data={items}
        numColumns={grid.columns}
        keyExtractor={(item) => item.id}
        extraData={selectedIds}
        renderItem={({ item }) => (
          <ItemTile
            item={item}
            colors={colors}
            size={tileSize}
            selected={selectedIds?.has(item.id)}
            showName={showNames}
            onPress={
              onPressItem
                ? () => onPressItem(item)
                : () => router.push(`/item/${item.id}`)
            }
            onLongPress={onLongPressItem ? () => onLongPressItem(item) : undefined}
          />
        )}
        contentContainerStyle={[
          styles.grid,
          { paddingTop: topInset + grid.gap, paddingBottom: bottomInset + grid.gap },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: {
    flex: 1,
    direction: "ltr",
    transform: [{ scaleX: -1 }],
  },
  grid: {
    padding: grid.gap,
  },
  tile: {
    margin: grid.gap / 2,
    overflow: "hidden",
    transform: [{ scaleX: -1 }],
  },
  // the dark ring keeps the dot readable on bright photos (handoff G01)
  dot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: photoOverlay.dotRing,
    zIndex: 1,
  },
  check: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  checkMark: {
    fontSize: 13,
    fontWeight: "700",
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
