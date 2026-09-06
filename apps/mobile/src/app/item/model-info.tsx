import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { openBrowserAsync } from "expo-web-browser";
import { radius, spacing, typography, type ThemeColors } from "@bitshelf/ui";
import { getCachedModelInfo } from "../../lib/model-info";
import { useThemeColors } from "../../lib/theme";

// Full model reference screen per artboard 05: specs, history, collector
// tips, known versions, verified links and the AI disclaimer. The record is
// shared by every copy of the same model (spec 4.6.1).

function Section({
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

export default function ModelInfoScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const colors = useThemeColors();
  const { manufacturer, model } = useLocalSearchParams<{
    manufacturer: string;
    model: string;
  }>();
  const info =
    manufacturer && model ? getCachedModelInfo(manufacturer, model) : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("modelInfo.title"),
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {!info ? (
          <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
            {t("modelInfo.unavailable")}
          </Text>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {info.model}
            </Text>
            <Text style={[styles.years, { color: colors.textSecondary }]}>
              {[info.releaseYear, info.discontinuedYear].filter(Boolean).join(" - ")}
            </Text>

            {Object.keys(info.specs).length > 0 ? (
              <Section label={t("modelInfo.specs")} colors={colors}>
                {Object.entries(info.specs).map(([key, value]) => (
                  <View key={key} style={styles.specRow}>
                    <Text style={[styles.specKey, { color: colors.textSecondary }]}>
                      {key}
                    </Text>
                    <Text style={[styles.specValue, { color: colors.textPrimary }]}>
                      {value}
                    </Text>
                  </View>
                ))}
              </Section>
            ) : null}

            {info.summary[lang] ?? info.summary.he ? (
              <Section label={t("modelInfo.history")} colors={colors}>
                <Text style={[styles.paragraph, { color: colors.textPrimary }]}>
                  {info.summary[lang] ?? info.summary.he}
                </Text>
              </Section>
            ) : null}

            {(info.tips[lang] ?? info.tips.he ?? []).length > 0 ? (
              <Section label={t("modelInfo.tips")} colors={colors}>
                {(info.tips[lang] ?? info.tips.he ?? []).map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Text style={{ color: colors.accent }}>{"•"}</Text>
                    <Text style={[styles.tipText, { color: colors.textPrimary }]}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </Section>
            ) : null}

            {info.knownVersions ? (
              <Section label={t("modelInfo.versions")} colors={colors}>
                <Text style={[styles.versions, { color: colors.textPrimary }]}>
                  {info.knownVersions}
                </Text>
              </Section>
            ) : null}

            {info.links.length > 0 ? (
              <View style={styles.linksRow}>
                {info.links.map((link) => (
                  <Pressable
                    key={link.url}
                    onPress={() => void openBrowserAsync(link.url)}
                    style={({ pressed }) => [
                      styles.linkChip,
                      { backgroundColor: pressed ? colors.surface2 : colors.surface },
                    ]}
                  >
                    <Text style={[styles.linkLabel, { color: colors.accent }]}>
                      {link.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
              {t("modelInfo.disclaimer")}
            </Text>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: "700",
    writingDirection: "ltr",
    textAlign: "left",
  },
  years: {
    fontFamily: typography.mono,
    fontSize: typography.sizes.secondary,
    writingDirection: "ltr",
    textAlign: "left",
  },
  card: {
    borderRadius: radius.card,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 13,
    textAlign: "left",
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.md,
  },
  specKey: {
    fontFamily: typography.mono,
    fontSize: 13,
    writingDirection: "ltr",
  },
  specValue: {
    fontSize: typography.sizes.secondary,
    flex: 1,
    textAlign: "left",
  },
  paragraph: {
    fontSize: typography.sizes.secondary + 1,
    lineHeight: 22,
    textAlign: "left",
  },
  tipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontSize: typography.sizes.secondary,
    lineHeight: 20,
    textAlign: "left",
  },
  versions: {
    fontFamily: typography.mono,
    fontSize: typography.sizes.secondary,
    writingDirection: "ltr",
    textAlign: "left",
  },
  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  linkChip: {
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
    lineHeight: 18,
  },
});
