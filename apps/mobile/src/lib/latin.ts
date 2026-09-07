import { I18nManager, type TextStyle } from "react-native";

// Latin-only strings (model names like "Apple IIc (ROM 4X)") must read left
// to right and hug the physical LEFT edge, like English text anywhere,
// instead of inheriting the Hebrew UI's right alignment (Rami, 07.09.2026).
// React Native swaps a Text's left/right in RTL mode, so asking for "right"
// lands on the physical left.

const HEBREW_RE = /[֐-׿]/;

export function isLatin(text: string | null | undefined): boolean {
  return typeof text === "string" && text !== "" && !HEBREW_RE.test(text);
}

// standalone titles and names: LTR reading, physically left aligned
export const latinTitle: TextStyle = {
  writingDirection: "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
};

// for centered or end-anchored contexts: fix the reading direction only,
// so brackets and numbers stop scrambling, without moving the text
export const latinFlow: TextStyle = {
  writingDirection: "ltr",
};
