import { useTranslation } from "react-i18next";
import { EmptyState } from "@bitshelf/ui";
import { useThemeColors } from "../../lib/theme";

export default function CollectionScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return <EmptyState title={t("collection.emptyTitle")} colors={colors} showLogo />;
}
