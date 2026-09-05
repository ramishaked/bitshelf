import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import { Button, radius, spacing, typography } from "@bitshelf/ui";
import { getItem } from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

// Post generator (spec 8.2): three styles, the user edits the text and
// sends it through the iOS share sheet. No direct posting APIs.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const STYLES = ["story", "sale", "question"] as const;
type PostStyle = (typeof STYLES)[number];

export default function PostScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { getToken } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useMemo(() => (id ? getItem(id) : null), [id]);
  const [style, setStyle] = useState<PostStyle>("story");
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const generate = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    setFailed(false);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/generate-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: item.title,
          year: (item.attributes.year as number) ?? null,
          condition: item.conditionGrade != null ? String(item.conditionGrade) : null,
          workingStatus: (item.attributes.working_status as string) ?? null,
          notes: item.notes,
          price: style === "sale" && price.trim() ? `₪${price.trim()}` : null,
          style,
          language: i18n.language === "en" ? "en" : "he",
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { text: string };
      setText(data.text);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [item, style, price, getToken, i18n.language]);

  useEffect(() => {
    void generate();
    // regenerate when the style flips, not on every keystroke of the price
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  if (!item) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: t("post.title"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
          {STYLES.map((key) => (
            <Pressable
              key={key}
              onPress={() => setStyle(key)}
              style={[
                styles.segment,
                style === key && { backgroundColor: colors.surface2 },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: style === key ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                {t(`post.style_${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {style === "sale" ? (
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder={t("post.pricePlaceholder")}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            style={[
              styles.price,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.textSecondary }}>{t("post.generating")}</Text>
          </View>
        ) : (
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            style={[
              styles.editor,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
        )}
        {failed ? (
          <Text style={{ color: colors.statusNotWorking, textAlign: "left" }}>
            {t("post.failed")}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={t("post.share")}
            onPress={() => void Share.share({ message: text })}
            colors={colors}
            disabled={!text || loading}
            style={styles.action}
          />
          <Button
            label={t("post.regenerate")}
            onPress={() => void generate()}
            colors={colors}
            variant="secondary"
            disabled={loading}
            style={styles.action}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: radius.tag + 2,
    padding: 2,
  },
  segment: {
    flex: 1,
    borderRadius: radius.tag,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
  },
  segmentLabel: {
    fontSize: typography.sizes.secondary,
    fontWeight: "600",
  },
  price: {
    height: 44,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    fontFamily: typography.mono,
    textAlign: "right",
    writingDirection: "ltr",
  },
  loading: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  editor: {
    minHeight: 180,
    borderRadius: radius.card,
    padding: spacing.md,
    fontSize: typography.sizes.body,
    lineHeight: 22,
    textAlign: "right",
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
