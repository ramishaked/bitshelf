import { Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-expo";
import { radius, spacing, type ThemeColors } from "@bitshelf/ui";
import { clerkEnabled } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";

function Row({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

// Separate component so useAuth is only called when ClerkProvider exists
function SignOutRow({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  const { isSignedIn, signOut } = useAuth();
  if (!isSignedIn) {
    return null;
  }
  return (
    <Pressable
      onPress={() => void signOut()}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.accentPressed : colors.surface },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.statusNotWorking }]}>
        {t("profile.signOut")}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <View style={styles.screen}>
      <Row
        label={t("profile.language")}
        value={i18n.language === "he" ? "עברית" : "English"}
        colors={colors}
      />
      <Row label={t("profile.version")} value={version} colors={colors} />
      {clerkEnabled ? (
        <SignOutRow colors={colors} />
      ) : (
        <Text style={[styles.devNote, { color: colors.textSecondary }]}>
          {t("profile.devNote")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.lg,
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
