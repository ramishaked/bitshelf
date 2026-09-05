import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@bitshelf/ui";
import { ItemGrid } from "../../components/item-grid";
import { ScreenHeader } from "../../components/screen-header";
import { listFavorites, type LocalItem } from "../../lib/store";
import { useThemeColors } from "../../lib/theme";

// Simple grid of everything marked as favorite (spec 7.4)
export default function FavoritesScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [items, setItems] = useState<LocalItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setItems(listFavorites());
    }, []),
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("tabs.favorites")} />
      {items.length === 0 ? (
        <EmptyState
          title={t("favorites.emptyTitle")}
          hint={t("favorites.emptyHint")}
          colors={colors}
        />
      ) : (
        <ItemGrid items={items} />
      )}
    </View>
  );
}
