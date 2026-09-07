import { Pressable, Text } from "react-native";

// A close control for modal screens (presentation: "modal"), which get no
// back chevron. Use as `headerLeft: headerClose(() => router.back(), color)`
// in a Stack.Screen's options.
export function headerClose(onPress: () => void, color: string) {
  return function HeaderClose() {
    return (
      <Pressable onPress={onPress} hitSlop={12} accessibilityLabel="סגור">
        <Text style={{ color, fontSize: 26, fontWeight: "400", lineHeight: 28 }}>
          {"×"}
        </Text>
      </Pressable>
    );
  };
}
