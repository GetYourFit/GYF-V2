import { expect, test } from "bun:test";

test("keeps the proven Expo native peer set", async () => {
  const manifest = await Bun.file(new URL("../../package.json", import.meta.url)).json();

  expect({
    expo: manifest.dependencies.expo,
    "expo-router": manifest.dependencies["expo-router"],
    "expo-constants": manifest.dependencies["expo-constants"],
    "expo-linking": manifest.dependencies["expo-linking"],
    "expo-image-picker": manifest.dependencies["expo-image-picker"],
    react: manifest.dependencies.react,
    "react-dom": manifest.dependencies["react-dom"],
    "react-native": manifest.dependencies["react-native"],
    "react-native-gesture-handler": manifest.dependencies["react-native-gesture-handler"],
    "react-native-reanimated": manifest.dependencies["react-native-reanimated"],
    "react-native-safe-area-context": manifest.dependencies["react-native-safe-area-context"],
    "react-native-worklets": manifest.dependencies["react-native-worklets"],
    typescript: manifest.devDependencies.typescript,
  }).toEqual({
    expo: "~57.0.7",
    "expo-router": "~57.0.7",
    "expo-constants": "~57.0.6",
    "expo-linking": "~57.0.3",
    "expo-image-picker": "~57.0.5",
    react: "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.86.0",
    "react-native-gesture-handler": "~2.32.0",
    "react-native-reanimated": "4.5.0",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-worklets": "0.10.0",
    typescript: "~6.0.3",
  });
});
