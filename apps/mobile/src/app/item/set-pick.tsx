import { useCallback, useState } from "react";
import { View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@bitshelf/ui";
import { ItemGrid } from "../../components/item-grid";
import { listSetCandidates, setItemParent, type LocalItem } from "../../lib/store";
import { requestSync } from "../../lib/sync";
import { useThemeColors } from "../../lib/theme";

// "Add to set" (spec 4.3): tap an item to attach it as a child. Depth is 1,
// so only parentless, childless items are offered.
export default function SetPickScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { parentId } = useLocalSearchParams<{ parentId: string }>();
  const [candidates, setCandidates] = useState<LocalItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setCandidates(parentId ? listSetCandidates(parentId) : []);
    }, [parentId]),
  );

  const attach = (item: LocalItem) => {
    if (!parentId) return;
    setItemParent(item.id, parentId);
    requestSync();
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("set.pickTitle"),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {candidates.length === 0 ? (
          <EmptyState title={t("set.pickEmpty")} colors={colors} />
        ) : (
          <ItemGrid items={candidates} onPressItem={attach} showNames />
        )}
      </View>
    </>
  );
}
