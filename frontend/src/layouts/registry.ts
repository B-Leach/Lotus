import type { ComponentType } from "react";
import type { LayoutProps } from "./types";
import { ClassicLayout } from "./classic/ClassicLayout";
import { CardsLayout } from "./d-cards/CardsLayout";
import { TavernLayout } from "./e-tavern/TavernLayout";
import { OrreryLayout } from "./f-orrery/OrreryLayout";
import { AetherLayout } from "./g-aether/AetherLayout";

export type LayoutId = "aether" | "d" | "e" | "f" | "g";

export interface LayoutEntry {
  id: LayoutId;
  name: string;
  component: ComponentType<LayoutProps>;
}

export const LAYOUTS: LayoutEntry[] = [
  { id: "aether", name: "Aether", component: AetherLayout },
  { id: "d", name: "Hand of cards", component: CardsLayout },
  { id: "e", name: "Tavern keeper", component: TavernLayout },
  { id: "f", name: "Mana orrery", component: OrreryLayout },
  { id: "g", name: "Classic", component: ClassicLayout },
];

export const DEFAULT_LAYOUT: LayoutId = "aether";

// Single source of truth — derived from LAYOUTS so new layouts can't be
// silently rejected by the ?layout= / localStorage validation.
export const LAYOUT_IDS: LayoutId[] = LAYOUTS.map((l) => l.id);

export function getLayout(id: string | null): LayoutEntry {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
