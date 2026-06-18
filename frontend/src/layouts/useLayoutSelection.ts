import { useCallback, useEffect, useState } from "react";
import {
  LAYOUTS,
  LAYOUT_IDS,
  DEFAULT_LAYOUT,
  getLayout,
  type LayoutId,
} from "./registry";

const LAYOUT_KEY = "lotus-layout";

function persist(id: LayoutId) {
  localStorage.setItem(LAYOUT_KEY, id);
  const url = new URL(window.location.href);
  url.searchParams.set("layout", id);
  window.history.replaceState({}, "", url);
}

function resolveInitial(): LayoutId {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("layout");
  if (fromUrl && LAYOUT_IDS.includes(fromUrl as LayoutId)) {
    return fromUrl as LayoutId;
  }
  const fromStorage = localStorage.getItem(LAYOUT_KEY);
  if (fromStorage && LAYOUT_IDS.includes(fromStorage as LayoutId)) {
    return fromStorage as LayoutId;
  }
  return DEFAULT_LAYOUT;
}

export function useLayoutSelection() {
  const [layoutId, setLayoutId] = useState<LayoutId>(() => resolveInitial());

  const select = useCallback((id: LayoutId) => {
    setLayoutId(id);
    persist(id);
  }, []);

  const cycle = useCallback(() => {
    setLayoutId((current) => {
      const idx = LAYOUTS.findIndex((l) => l.id === current);
      const next = LAYOUTS[(idx + 1) % LAYOUTS.length].id;
      persist(next);
      return next;
    });
  }, []);

  // Ctrl+Shift+L cycles layouts (dev-only switcher)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        cycle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  return { layoutId, entry: getLayout(layoutId), select, cycle };
}
