import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  controls,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from "@bitshelf/ui";
import {
  conditionLabels,
  fieldsForCategory,
  isIncomplete,
  isLatinField,
  statusColor,
} from "../../lib/retro";
import { deletePhotoFiles } from "../../lib/photos";
import { deleteItem, getItem, type LocalItem } from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

function Tag({
  children,
  colors,
  dotColor,
  textColor,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  dotColor?: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface }]}>
      {dotColor ? <View style={[styles.tagDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.tagLabel, { color: textColor ?? colors.textPrimary }]}>
        {children}
      </Text>
    </View>
  );
}

function Card({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function ItemScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<LocalItem | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setItem(id ? getItem(id) : null);
    }, [id]),
  );

  if (!item) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  const workingStatus = item.attributes.working_status as string | undefined;
  const completeness = item.attributes.completeness as string | undefined;
  const year = item.attributes.year as number | undefined;
  const region = item.attributes.region as string | undefined;
  const incomplete = isIncomplete(item.category, item.attributes, item.conditionGrade);
  const detailFields = fieldsForCategory(item.category).filter((f) => {
    const v = item.attributes[f.key];
    return v != null && v !== "" && f.key !== "working_status";
  });

  const confirmDelete = () => {
    Alert.alert(t("item.deleteConfirmTitle"), t("item.deleteConfirmBody"), [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("item.delete"),
        style: "destructive",
        onPress: () => {
          deletePhotoFiles(item.photos);
          deleteItem(item.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {item.photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))
              }
            >
              {item.photos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.uri }}
                  style={{ width, height: 260 }}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
            {item.photos.length > 1 ? (
              <View style={styles.dots}>
                {item.photos.map((photo, i) => (
                  <View
                    key={photo.id}
                    style={[
                      styles.dotIndicator,
                      {
                        backgroundColor: colors.textPrimary,
                        opacity: i === photoIndex ? 1 : 0.35,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.noPhoto, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.textSecondary }}>{t("item.noPhoto")}</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {[
              year != null ? String(year) : null,
              region ?? null,
              item.storageLocation,
            ]
              .filter(Boolean)
              .join(", ")}
          </Text>

          <View style={styles.tagsRow}>
            <Tag
              colors={colors}
              dotColor={statusColor(workingStatus, colors)}
            >
              {t(`status.${workingStatus ?? "untested"}`)}
            </Tag>
            {item.conditionGrade != null ? (
              <Tag colors={colors}>
                {`${item.conditionGrade}/5 ${conditionLabels[String(item.conditionGrade)]?.[lang] ?? ""}`}
              </Tag>
            ) : null}
            {completeness ? (
              <Tag colors={colors}>{t(`completeness.${completeness}`)}</Tag>
            ) : null}
            {incomplete ? (
              <Tag colors={colors} textColor={colors.statusPartiallyWorking}>
                {t("item.toComplete")}
              </Tag>
            ) : null}
          </View>

          {detailFields.length > 0 ? (
            <Card label={t("item.details")} colors={colors}>
              {detailFields.map((field) => (
                <View key={field.key} style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textSecondary }]}>
                    {field.label[lang]}
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: colors.textPrimary },
                      isLatinField(field.key) && styles.mono,
                    ]}
                  >
                    {field.type === "enum"
                      ? field.key === "completeness"
                        ? t(`completeness.${item.attributes[field.key]}`)
                        : field.key === "media_type"
                          ? t(`media.${item.attributes[field.key]}`)
                          : String(item.attributes[field.key])
                      : String(item.attributes[field.key])}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {item.purchasePrice ? (
            <Card label={t("item.purchaseSection")} colors={colors}>
              <Text style={[styles.mono, { color: colors.textPrimary, fontSize: 15 }]}>
                {`${item.purchaseCurrency === "USD" ? "$" : "₪"}${item.purchasePrice}`}
                {item.purchaseSource ? `  ·  ${item.purchaseSource}` : ""}
              </Text>
            </Card>
          ) : null}

          {item.notes ? (
            <Card label={t("item.notes")} colors={colors}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 21 }}>
                {item.notes}
              </Text>
            </Card>
          ) : null}

          {!item.synced ? (
            <Text style={[styles.syncNote, { color: colors.textSecondary }]}>
              {t("item.notSynced")}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push(`/item/new?id=${item.id}`)}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: pressed ? colors.accentPressed : colors.accent },
              ]}
            >
              <Text style={[styles.actionLabel, { color: colors.onAccent }]}>
                {t("item.editTitle")}
              </Text>
            </Pressable>
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
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  noPhoto: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: "700",
    writingDirection: "ltr",
    textAlign: "right",
  },
  subtitle: {
    fontSize: typography.sizes.secondary,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.tag,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagLabel: {
    fontSize: 13,
  },
  card: {
    borderRadius: radius.card,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 13,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  detailKey: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: typography.sizes.secondary,
  },
  mono: {
    fontFamily: typography.mono,
    writingDirection: "ltr",
  },
  syncNote: {
    fontSize: typography.sizes.caption,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
    height: controls.buttonHeight,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
});
