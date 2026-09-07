import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { radius, spacing, type ThemeColors } from "@bitshelf/ui";
import { ScreenHeader } from "../../components/screen-header";
import { clerkEnabled } from "../../lib/auth";
import { exportCsv } from "../../lib/export";
import { wipeLocalData } from "../../lib/store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
import {
  setThemeMode,
  useThemeColors,
  useThemeMode,
  type ThemeMode,
} from "../../lib/theme";

function Row({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

// Separate component so the Clerk hooks are only called when ClerkProvider
// exists. Always visible with Clerk configured: inside the tabs the user is
// signed in by definition, and hiding it while Clerk loads made it look
// like sign-out does not exist.
function SignOutRow({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  // account deletion (spec 12, App Store requirement): two explicit
  // confirmations, then the server wipes Neon and the Clerk user, the
  // device wipes its cache and the session signs out
  const deleteAccount = () => {
    Alert.alert(t("profile.deleteAccountTitle"), t("profile.deleteAccountBody"), [
      { text: t("item.cancel"), style: "cancel" },
      {
        text: t("profile.deleteAccountConfirm"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("profile.deleteAccountFinalTitle"), email, [
            { text: t("item.cancel"), style: "cancel" },
            {
              text: t("profile.deleteAccountFinalConfirm"),
              style: "destructive",
              onPress: () => {
                void (async () => {
                  try {
                    const token = await getToken();
                    const response = await fetch(`${API_URL}/api/account`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!response.ok) throw new Error(String(response.status));
                    wipeLocalData();
                    await signOut();
                  } catch {
                    Alert.alert(t("profile.deleteAccountFailed"));
                  }
                })();
              },
            },
          ]);
        },
      },
    ]);
  };

  return (
    <>
      {email ? (
        <Row label={t("profile.account")} value={email} colors={colors} />
      ) : null}
      <Pressable
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.surface2 : colors.surface },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.statusNotWorking }]}>
          {t("profile.signOut")}
        </Text>
      </Pressable>
      <Pressable
        onPress={deleteAccount}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.surface2 : colors.surface },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.statusNotWorking }]}>
          {t("profile.deleteAccount")}
        </Text>
      </Pressable>
    </>
  );
}

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: "dark",
  dark: "light",
  light: "system",
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const mode = useThemeMode();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("tabs.profile")} />
      <View style={styles.screen}>
      <Row
        label={t("profile.language")}
        value={i18n.language === "he" ? "עברית" : "English"}
        colors={colors}
      />
      {/* tap cycles system, dark, light (spec: dark default, light must work) */}
      <Pressable onPress={() => setThemeMode(NEXT_MODE[mode])}>
        <Row
          label={t("profile.appearance")}
          value={t(`profile.appearance_${mode}`)}
          colors={colors}
        />
      </Pressable>
      <Pressable onPress={() => router.push("/wishlist")}>
        <Row label={t("wishlist.title")} value="" colors={colors} />
      </Pressable>
      <Pressable onPress={() => router.push("/showcase")}>
        <Row label={t("showcase.title")} value="" colors={colors} />
      </Pressable>
      <Pressable
        onPress={() =>
          void exportCsv().catch(() => {
            // share sheet dismissed or write failed, nothing to do
          })
        }
      >
        <Row label={t("profile.exportCsv")} value="CSV" colors={colors} />
      </Pressable>
      <Row label={t("profile.version")} value={version} colors={colors} />
      {clerkEnabled ? (
        <SignOutRow colors={colors} />
      ) : (
        <Text style={[styles.devNote, { color: colors.textSecondary }]}>
          {t("profile.devNote")}
        </Text>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowValue: {
    fontSize: 15,
  },
  devNote: {
    marginTop: spacing.md,
    fontSize: 13,
    textAlign: "center",
  },
});
