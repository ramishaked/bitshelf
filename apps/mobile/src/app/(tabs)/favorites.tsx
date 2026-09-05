import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@bitshelf/ui";
import { ScreenHeader } from "../../components/screen-header";
import { useThemeColors } from "../../lib/theme";

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("tabs.favorites")} />
      <EmptyState
        title={t("favorites.emptyTitle")}
        hint={t("favorites.emptyHint")}
        colors={colors}
      />
    </View>
  );
}
