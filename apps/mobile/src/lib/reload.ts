import { DevSettings } from "react-native";
import * as Updates from "expo-updates";

export async function reloadApp() {
  try {
    await Updates.reloadAsync();
  } catch {
    // expo-updates refuses to reload in development, DevSettings covers it
    DevSettings.reload();
  }
}
