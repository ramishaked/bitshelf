import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { controls, radius, spacing } from "@bitshelf/ui";
import { useGuest } from "../lib/auth";
import { useThemeColors } from "../lib/theme";

export default function GuestScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { setGuest } = useGuest();
  const [slug, setSlug] = useState("");

  const openGallery = () => {
    const clean = slug.trim();
    if (clean) {
      router.push(`/g/${encodeURIComponent(clean)}`);
    }
  };

  const backToSignIn = () => {
    setGuest(false);
    router.replace("/sign-in");
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t("guest.title")}</Text>
      <Text style={[styles.explain, { color: colors.textSecondary }]}>{t("guest.explain")}</Text>
      <TextInput
        value={slug}
        onChangeText={setSlug}
        placeholder={t("guest.slugPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
      />
      <Pressable
        onPress={openGallery}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>{t("guest.open")}</Text>
      </Pressable>
      <Pressable onPress={backToSignIn} style={styles.link}>
        <Text style={[styles.linkLabel, { color: colors.accent }]}>{t("guest.backToSignIn")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  explain: {
    fontSize: 15,
    textAlign: "center",
  },
  input: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    // gallery slugs are latin: LTR character order, right-aligned like the form
    textAlign: "right",
    writingDirection: "ltr",
  },
  button: {
    borderRadius: radius.card,
    height: controls.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
