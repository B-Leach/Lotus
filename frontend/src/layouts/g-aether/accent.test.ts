import { describe, it, expect } from "vitest";
import { accentFor, MANA_DOTS } from "./accent";

describe("accentFor", () => {
  it("maps each theme to its refined accent", () => {
    expect(accentFor("default")).toBe("#9a7b3d");
    expect(accentFor("white")).toBe("#b08900");
    expect(accentFor("blue")).toBe("#2f6f9e");
    expect(accentFor("black")).toBe("#5d5470");
    expect(accentFor("red")).toBe("#c0504a");
    expect(accentFor("green")).toBe("#2f6f5e");
  });

  it("falls back to the default accent for an unknown theme", () => {
    expect(accentFor("zzz" as never)).toBe("#9a7b3d");
  });
});

describe("MANA_DOTS", () => {
  it("lists all six themes in order with labels", () => {
    expect(MANA_DOTS.map((d) => d.theme)).toEqual([
      "default", "white", "blue", "black", "red", "green",
    ]);
    expect(MANA_DOTS.find((d) => d.theme === "blue")?.label).toBe("Islands");
  });
});
