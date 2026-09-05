import { useColorScheme } from "react-native";
import { themes, type ThemeColors } from "@bitshelf/ui";

// Dark is the default: anything that is not explicitly light renders dark
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return themes[scheme === "light" ? "light" : "dark"];
}
