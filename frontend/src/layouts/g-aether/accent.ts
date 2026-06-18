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

export const MANA_DOTS: { theme: Theme; label: string }[] = [
  { theme: "default", label: "Magic" },
  { theme: "white", label: "Plains" },
  { theme: "blue", label: "Islands" },
  { theme: "black", label: "Swamps" },
  { theme: "red", label: "Mountains" },
  { theme: "green", label: "Forests" },
];
