import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayoutSelection } from "./useLayoutSelection";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("useLayoutSelection", () => {
  it("defaults to aether", () => {
    const { result } = renderHook(() => useLayoutSelection());
    expect(result.current.layoutId).toBe("aether");
  });

  it("reads ?layout= from the URL", () => {
    window.history.replaceState({}, "", "/?layout=d");
    const { result } = renderHook(() => useLayoutSelection());
    expect(result.current.layoutId).toBe("d");
  });

  it("falls back to the default (aether) for an unknown id", () => {
    window.history.replaceState({}, "", "/?layout=zzz");
    const { result } = renderHook(() => useLayoutSelection());
    expect(result.current.layoutId).toBe("aether");
  });

  it("cycle() advances and persists to localStorage", () => {
    const { result } = renderHook(() => useLayoutSelection());
    act(() => result.current.cycle());
    expect(localStorage.getItem("lotus-layout")).toBe(result.current.layoutId);
  });
});
