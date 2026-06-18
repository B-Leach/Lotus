import type { ComponentType } from "react";
import type { LayoutProps } from "./types";
import { ClassicLayout } from "./classic/ClassicLayout";
import { CardsLayout } from "./d-cards/CardsLayout";

export type LayoutId = "classic" | "d" | "e" | "f";

export interface LayoutEntry {
  id: LayoutId;
  name: string;
  component: ComponentType<LayoutProps>;
}

// D/E/F are appended in their respective tasks.
export const LAYOUTS: LayoutEntry[] = [
  { id: "classic", name: "Classic", component: ClassicLayout },
  { id: "d", name: "Hand of cards", component: CardsLayout },
];

export const DEFAULT_LAYOUT: LayoutId = "classic";

export const LAYOUT_IDS: LayoutId[] = ["classic", "d", "e", "f"];

export function getLayout(id: string | null): LayoutEntry {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
