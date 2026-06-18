import type { Theme } from "../../components/ThemeSelector";

const ACCENTS: Record<Theme, string> = {
  default: "#9a7b3d",
  white: "#b08900",
  blue: "#2f6f9e",
  black: "#5d5470",
  red: "#c0504a",
  green: "#2f6f5e",
};

export function accentFor(theme: Theme): string {
  return ACCENTS[theme] ?? ACCENTS.default;
}

const DARK_ACCENTS: Record<Theme, string> = {
  default: "#e0b85c",
  white: "#e8dca0",
  blue: "#4aa8e0",
  black: "#a98fd6",
  red: "#ef6a62",
  green: "#54e0c7",
};

export function accentForDark(theme: Theme): string {
  return DARK_ACCENTS[theme] ?? DARK_ACCENTS.default;
}

export const MANA_DOTS: { theme: Theme; label: string }[] = [
  { theme: "default", label: "Magic" },
  { theme: "white", label: "Plains" },
  { theme: "blue", label: "Islands" },
  { theme: "black", label: "Swamps" },
  { theme: "red", label: "Mountains" },
  { theme: "green", label: "Forests" },
];
