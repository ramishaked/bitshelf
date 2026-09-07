import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useTranslation } from "react-i18next";
import { controls, radius, spacing, typography } from "@bitshelf/ui";
import { clerkEnabled } from "../lib/auth";
import { collectorUrl } from "../lib/gallery-link";
import { getProfile, saveProfile, type LocalProfile } from "../lib/store";
import { requestSync } from "../lib/sync";
import { useThemeColors } from "../lib/theme";

// Collector showcase editor (spec 8.1.2): handle, title, bio and a publish
// toggle. Publishing exposes /u/<handle> with all the collector's public
// galleries. One link, shared from here.
export default function ShowcaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [profile, setProfile] = useState<LocalProfile>(() => getProfile());
  // clerkEnabled is constant for the app's lifetime, the hook order is stable
  const { user } = clerkEnabled
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useUser()
    : { user: null };

  // a handle is just the username in the URL; suggest one from the account
  // so nobody has to invent it (first name, else the email's local part)
  useEffect(() => {
    if (profile.handle || !user) return;
    const source =
      user.firstName ?? user.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "";
    const suggested = source
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 30);
    if (suggested) setProfile((p) => ({ ...p, handle: suggested }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const update = (patch: Partial<LocalProfile>) =>
    setProfile((p) => ({ ...p, ...patch }));

  const normalizedHandle = profile.handle
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);

  const persist = (next: LocalProfile) => {
    saveProfile(next);
    setProfile(next);
    requestSync();
  };

  const togglePublish = (value: boolean) => {
    if (value && !normalizedHandle) {
      Alert.alert(t("showcase.needsHandle"));
      return;
    }
    persist({ ...profile, handle: normalizedHandle, showcasePublished: value });
  };

  const saveFields = () => {
    persist({ ...profile, handle: normalizedHandle });
    Alert.alert(t("showcase.saved"));
  };

  const url = normalizedHandle ? collectorUrl(normalizedHandle) : "";
  const canShare = profile.showcasePublished && !!normalizedHandle;

  return (
    <>
      <Stack.Screen
        options={{
          title: t("showcase.title"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          {t("showcase.intro")}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("showcase.handle")}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t("showcase.handleHint")}
        </Text>
        <View style={styles.handleRow}>
          <Text style={[styles.handlePrefix, { color: colors.textSecondary }]}>/u/</Text>
          <TextInput
            value={profile.handle}
            onChangeText={(v) => update({ handle: v })}
            onBlur={() => update({ handle: normalizedHandle })}
            placeholder="rami"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.handleInput,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("showcase.showcaseTitle")}
        </Text>
        <TextInput
          value={profile.showcaseTitle}
          onChangeText={(v) => update({ showcaseTitle: v })}
          placeholder={t("showcase.titlePlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.textPrimary },
          ]}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("showcase.bio")}
        </Text>
        <TextInput
          value={profile.bio}
          onChangeText={(v) => update({ bio: v })}
          placeholder={t("showcase.bioPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.input,
            styles.bio,
            { backgroundColor: colors.surface, color: colors.textPrimary },
          ]}
        />

        <Pressable
          onPress={saveFields}
          style={({ pressed }) => [
            styles.saveRow,
            { backgroundColor: pressed ? colors.surface2 : colors.surface },
          ]}
        >
          <Text style={[styles.saveLabel, { color: colors.accent }]}>
            {t("showcase.save")}
          </Text>
        </Pressable>

        <View style={[styles.publishRow, { backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.publishLabel, { color: colors.textPrimary }]}>
              {t("showcase.publish")}
            </Text>
            <Text style={[styles.publishHint, { color: colors.textSecondary }]}>
              {t("showcase.publishHint")}
            </Text>
          </View>
          <Switch
            value={profile.showcasePublished}
            onValueChange={togglePublish}
            trackColor={{ true: colors.accent }}
          />
        </View>

        {canShare ? (
          <View style={[styles.linkCard, { backgroundColor: colors.surface }]}>
            <Text
              numberOfLines={1}
              style={[styles.linkText, { color: colors.accent }]}
            >
              {url}
            </Text>
            <View style={styles.linkActions}>
              <Pressable onPress={() => void Linking.openURL(url)}>
                <Text style={[styles.linkAction, { color: colors.accent }]}>
                  {t("gallery.openInBrowser")}
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(url);
                  Alert.alert(t("gallery.linkCopied"));
                }}
              >
                <Text style={[styles.linkAction, { color: colors.textPrimary }]}>
                  {t("gallery.copyLink")}
                </Text>
              </Pressable>
              <Pressable onPress={() => void Share.share({ message: url })}>
                <Text style={[styles.linkAction, { color: colors.textPrimary }]}>
                  {t("gallery.share")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  intro: {
    fontSize: typography.sizes.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
    textAlign: "left",
  },
  label: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
    marginTop: spacing.sm,
  },
  hint: {
    fontSize: typography.sizes.caption,
    textAlign: "left",
    lineHeight: 16,
  },
  input: {
    height: controls.buttonHeight - 4,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    textAlign: "right",
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  handlePrefix: {
    fontFamily: typography.mono,
    fontSize: typography.sizes.body,
    writingDirection: "ltr",
  },
  handleInput: {
    flex: 1,
    height: controls.buttonHeight - 4,
    borderRadius: radius.card - 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    fontFamily: typography.mono,
    textAlign: "left",
    writingDirection: "ltr",
  },
  bio: {
    height: 96,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  saveRow: {
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  saveLabel: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
  },
  publishRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  publishLabel: {
    fontSize: typography.sizes.body,
    fontWeight: "600",
    textAlign: "left",
  },
  publishHint: {
    fontSize: typography.sizes.caption + 1,
    textAlign: "left",
    marginTop: 2,
  },
  linkCard: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  linkText: {
    fontFamily: typography.mono,
    fontSize: typography.sizes.caption + 1,
    writingDirection: "ltr",
    textAlign: "left",
  },
  linkActions: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  linkAction: {
    fontSize: typography.sizes.secondary,
    fontWeight: "600",
  },
});
