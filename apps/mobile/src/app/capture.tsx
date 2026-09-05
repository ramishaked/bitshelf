import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { photoOverlay, radius, spacing, type ThemeColors } from "@bitshelf/ui";
import { addPhotos, deletePhotoFiles, processAsset } from "../lib/photos";
import { setPendingPhotos } from "../lib/pending";
import { useThemeColors } from "../lib/theme";
import type { LocalPhoto } from "../lib/store";

// Custom camera screen (spec 6.1 step 1): guide frame, flash, library pick,
// several shots in a row before identification.
export default function CaptureScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

  const shoot = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (shot) {
        const processed = await processAsset({
          uri: shot.uri,
          width: shot.width,
          height: shot.height,
        });
        setPhotos((prev) => [...prev, processed]);
      }
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    const added = await addPhotos("library");
    if (added.length) setPhotos((prev) => [...prev, ...added]);
  };

  const close = () => {
    deletePhotoFiles(photos);
    router.back();
  };

  const identify = () => {
    if (photos.length === 0) return;
    setPendingPhotos(photos);
    router.push("/item/confirm");
    setPhotos([]);
  };

  if (!permission) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.screen,
          styles.permissionWrap,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
          {t("capture.permission")}
        </Text>
        <Pressable onPress={() => void requestPermission()}>
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "600" }}>
            OK
          </Text>
        </Pressable>
        <Pressable onPress={close}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
            {t("capture.close")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        enableTorch={flash}
      />
      {/* guide frame */}
      <View pointerEvents="none" style={styles.guideWrap}>
        <View style={[styles.guide, { borderColor: photoOverlay.text }]} />
        <Text style={[styles.guideText, { color: photoOverlay.text }]}>
          {photos.length === 0 ? t("capture.guide") : t("capture.hint")}
        </Text>
      </View>
      {/* top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={close} style={styles.topButton}>
          <Text style={[styles.topLabel, { color: photoOverlay.text }]}>
            {t("capture.close")}
          </Text>
        </Pressable>
        <Pressable onPress={() => setFlash((f) => !f)} style={styles.topButton}>
          <Text style={[styles.topLabel, { color: flash ? colors.accent : photoOverlay.text }]}>
            {"⚡"}
          </Text>
        </Pressable>
      </View>
      {/* bottom bar */}
      <View style={styles.bottomBar}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.thumbs}>
              {photos.map((photo) => (
                <Image key={photo.id} source={{ uri: photo.thumbUri }} style={styles.thumb} />
              ))}
            </View>
          </ScrollView>
        ) : null}
        <View style={styles.controls}>
          <Pressable onPress={() => void pickFromLibrary()} style={styles.sideButton}>
            <Text style={[styles.sideLabel, { color: photoOverlay.text }]}>
              {t("capture.fromLibrary")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void shoot()}
            style={[styles.shutter, { borderColor: photoOverlay.text, opacity: busy ? 0.5 : 1 }]}
          >
            <View style={[styles.shutterInner, { backgroundColor: photoOverlay.text }]} />
          </Pressable>
          <Pressable
            onPress={identify}
            disabled={photos.length === 0}
            style={[
              styles.identifyButton,
              {
                backgroundColor: photos.length ? colors.accent : "transparent",
                opacity: photos.length ? 1 : 0.4,
              },
            ]}
          >
            <Text
              style={[
                styles.sideLabel,
                { color: photos.length ? colors.onAccent : photoOverlay.text },
              ]}
            >
              {t("capture.identify", { count: photos.length })}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  permissionWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  permissionText: {
    fontSize: 15,
    textAlign: "center",
  },
  guideWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  guide: {
    width: "78%",
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: radius.card,
    opacity: 0.7,
  },
  guideText: {
    fontSize: 14,
    opacity: 0.9,
  },
  topBar: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  topButton: {
    padding: spacing.sm,
  },
  topLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 40,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  thumbs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.tag,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  sideButton: {
    width: 96,
  },
  sideLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  identifyButton: {
    width: 96,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.chip,
  },
});
