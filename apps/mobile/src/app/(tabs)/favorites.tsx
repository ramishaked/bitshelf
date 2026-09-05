import { useTranslation } from "react-i18next";
import { EmptyState } from "@bitshelf/ui";
import { useThemeColors } from "../../lib/theme";

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <EmptyState
      title={t("favorites.emptyTitle")}
      hint={t("favorites.emptyHint")}
      colors={colors}
    />
  );
}
