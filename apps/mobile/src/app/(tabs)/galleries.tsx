import { useTranslation } from "react-i18next";
import { EmptyState } from "@bitshelf/ui";
import { useThemeColors } from "../../lib/theme";

export default function GalleriesScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <EmptyState
      title={t("galleries.emptyTitle")}
      hint={t("galleries.emptyHint")}
      colors={colors}
    />
  );
}
