import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { useSignIn, useSSO } from "@clerk/clerk-expo";
import { controls, LogoPlaceholder, radius, spacing, type ThemeColors } from "@bitshelf/ui";
import { clerkEnabled, useGuest } from "../lib/auth";
import { useThemeColors } from "../lib/theme";

WebBrowser.maybeCompleteAuthSession();

function AuthButton({
  label,
  onPress,
  colors,
  prominent = false,
}: {
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  prominent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed
            ? colors.accentPressed
            : prominent
              ? colors.accent
              : colors.surface,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          { color: prominent ? colors.onAccent : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Separate component so Clerk hooks are only called when ClerkProvider exists
function ClerkSignIn({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"buttons" | "email" | "code">("buttons");
  const [failed, setFailed] = useState(false);

  const signInWith = async (strategy: "oauth_apple" | "oauth_google") => {
    setFailed(false);
    try {
      const { createdSessionId, setActive: setActiveSso } = await startSSOFlow({ strategy });
      if (createdSessionId && setActiveSso) {
        await setActiveSso({ session: createdSessionId });
        router.replace("/");
      }
    } catch {
      setFailed(true);
    }
  };

  const sendCode = async () => {
    if (!isLoaded || !email.trim()) return;
    setFailed(false);
    try {
      await signIn.create({ identifier: email.trim(), strategy: "email_code" });
      setStep("code");
    } catch {
      setFailed(true);
    }
  };

  const verifyCode = async () => {
    if (!isLoaded || !code.trim()) return;
    setFailed(false);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
  };

  return (
    <View style={styles.buttons}>
      {step === "buttons" ? (
        <>
          <AuthButton
            label={t("auth.apple")}
            onPress={() => void signInWith("oauth_apple")}
            colors={colors}
            prominent
          />
          <AuthButton
            label={t("auth.google")}
            onPress={() => void signInWith("oauth_google")}
            colors={colors}
          />
          <AuthButton label={t("auth.email")} onPress={() => setStep("email")} colors={colors} />
        </>
      ) : null}
      {step === "email" ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
          <AuthButton label={t("auth.sendCode")} onPress={() => void sendCode()} colors={colors} prominent />
        </>
      ) : null}
      {step === "code" ? (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t("auth.codePlaceholder")}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.textPrimary },
            ]}
          />
          <AuthButton label={t("auth.verify")} onPress={() => void verifyCode()} colors={colors} prominent />
        </>
      ) : null}
      {failed ? (
        <Text style={[styles.error, { color: colors.statusNotWorking }]}>{t("auth.error")}</Text>
      ) : null}
    </View>
  );
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { setGuest } = useGuest();

  const continueAsGuest = () => {
    setGuest(true);
    router.replace("/guest");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <LogoPlaceholder />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("auth.subtitle")}
      </Text>
      {clerkEnabled ? (
        <ClerkSignIn colors={colors} />
      ) : (
        <View style={styles.buttons}>
          <Text style={[styles.error, { color: colors.textSecondary }]}>
            {t("auth.notConfigured")}
          </Text>
        </View>
      )}
      <Pressable onPress={continueAsGuest} style={styles.guestLink}>
        <Text style={[styles.guestLabel, { color: colors.accent }]}>{t("auth.guest")}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.md,
    fontSize: 15,
  },
  buttons: {
    alignSelf: "stretch",
    marginTop: spacing.xxl,
    gap: spacing.sm,
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
  input: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    textAlign: "right",
  },
  error: {
    marginTop: spacing.sm,
    fontSize: 13,
    textAlign: "center",
  },
  guestLink: {
    marginTop: spacing.xl,
  },
  guestLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
