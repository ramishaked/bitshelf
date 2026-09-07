import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, radius, spacing, typography } from "@bitshelf/ui";
import { buildTitle } from "../lib/retro";
import {
  deleteWish,
  listWishes,
  newItemId,
  saveItem,
  saveWish,
  type LocalItem,
  type LocalWish,
} from "../lib/store";
import { requestSync } from "../lib/sync";
import { useThemeColors } from "../lib/theme";
import { isLatin, latinTitle } from "../lib/latin";

// Wishlist (spec 7.9): a simple list sorted by priority. Adding takes four
// fields, everything else is optional. "Purchased" creates an item and
// opens the item form to complete it.

const NEXT_STATUS: Record<LocalWish["status"], LocalWish["status"]> = {
  searching: "found",
  found: "searching",
  purchased: "purchased",
};

export default function WishlistScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [wishes, setWishes] = useState<LocalWish[]>([]);
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);

  const reload = useCallback(() => setWishes(listWishes()), []);
  useFocusEffect(reload);

  const add = () => {
    if (!manufacturer.trim() && !model.trim()) return;
    const now = new Date().toISOString();
    saveWish({
      id: randomUUID(),
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      variant: variant.trim() || null,
      targetPrice: targetPrice.trim() || null,
      priority,
      status: "searching",
      createdAt: now,
      updatedAt: now,
    });
    setManufacturer("");
    setModel("");
    setVariant("");
    setTargetPrice("");
    setPriority(2);
    reload();
  };

  const cycleStatus = (wish: LocalWish) => {
    if (wish.status === "purchased") return;
    saveWish({
      ...wish,
      status: NEXT_STATUS[wish.status],
      updatedAt: new Date().toISOString(),
    });
    reload();
  };

  // spec 7.9: purchased creates an Item and moves to the form to complete it
  const markPurchased = (wish: LocalWish) => {
    const now = new Date().toISOString();
    const attributes: Record<string, unknown> = {
      manufacturer: wish.manufacturer || undefined,
      model: wish.model || undefined,
      variant: wish.variant ?? undefined,
      working_status: "untested",
    };
    const item: LocalItem = {
      id: newItemId(),
      category: "computer",
      title: buildTitle("computer", attributes, t("item.untitled")),
      attributes,
      conditionGrade: null,
      conditionNotes: null,
      storageLocation: null,
      notes: null,
      purchasePrice: null,
      purchaseCurrency: null,
      purchaseSource: null,
      isPrivate: true,
      isFavorite: false,
      tags: [],
      photos: [],
      createdAt: now,
      updatedAt: now,
      synced: false,
    };
    saveItem(item);
    saveWish({ ...wish, status: "purchased", updatedAt: now });
    requestSync();
    router.push(`/item/new?id=${item.id}`);
  };

  const confirmDelete = (wish: LocalWish) => {
    Alert.alert(t("wishlist.deleteTitle"), "", [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("item.delete"),
        style: "destructive",
        onPress: () => {
          deleteWish(wish.id);
          reload();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("wishlist.title"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.form, { backgroundColor: colors.surface }]}>
          <View style={styles.formRow}>
            <TextInput
              value={manufacturer}
              onChangeText={setManufacturer}
              placeholder={t("wishlist.manufacturer")}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.surface2, color: colors.textPrimary }]}
            />
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder={t("wishlist.model")}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.surface2, color: colors.textPrimary }]}
            />
          </View>
          <View style={styles.formRow}>
            <TextInput
              value={variant}
              onChangeText={setVariant}
              placeholder={t("wishlist.variant")}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.surface2, color: colors.textPrimary }]}
            />
            <TextInput
              value={targetPrice}
              onChangeText={setTargetPrice}
              placeholder={t("wishlist.targetPrice")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              style={[styles.input, { backgroundColor: colors.surface2, color: colors.textPrimary }]}
            />
          </View>
          <View style={styles.priorityRow}>
            {([1, 2, 3] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                style={[
                  styles.priorityChip,
                  {
                    backgroundColor:
                      priority === p ? colors.accentPressed : colors.surface2,
                  },
                ]}
              >
                <Text
                  style={{
                    color: priority === p ? colors.onAccent : colors.textSecondary,
                    fontSize: 13,
                  }}
                >
                  {t(`wishlist.priority_${p}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={t("wishlist.add")}
            onPress={add}
            colors={colors}
            disabled={!manufacturer.trim() && !model.trim()}
          />
        </View>

        {wishes.length === 0 ? (
          <EmptyState title={t("wishlist.empty")} colors={colors} />
        ) : (
          wishes.map((wish) => (
            <Pressable
              key={wish.id}
              onLongPress={() => confirmDelete(wish)}
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              <View style={styles.cardTop}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.textPrimary },
                    isLatin(wish.manufacturer) && latinTitle,
                  ]}
                >
                  {[wish.manufacturer, wish.model, wish.variant]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
                <Pressable
                  onPress={() => cycleStatus(wish)}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor:
                        wish.status === "purchased" ? colors.accentPressed : colors.surface2,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        wish.status === "purchased"
                          ? colors.onAccent
                          : colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    {t(`wishlist.status_${wish.status}`)}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.cardBottom}>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {t(`wishlist.priority_${wish.priority}`)}
                  {wish.targetPrice ? `  ·  ₪${wish.targetPrice}` : ""}
                </Text>
                {wish.status !== "purchased" ? (
                  <Pressable onPress={() => markPurchased(wish)}>
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600" }}>
                      {t("wishlist.purchased")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  form: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: radius.tag,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.secondary,
    textAlign: "right",
  },
  priorityRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  priorityChip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  card: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: "600",
    writingDirection: "ltr",
    textAlign: "left",
  },
  statusChip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    fontSize: typography.sizes.caption + 1,
  },
});
