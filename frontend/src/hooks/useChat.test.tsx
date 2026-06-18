import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "./useChat";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useChat", () => {
  it("starts with no conversations and default theme", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.conversations).toEqual([]);
    expect(result.current.theme).toBe("default");
    expect(result.current.activeConversationId).toBeNull();
  });

  it("creates a new conversation and makes it active", () => {
    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.createNewConversation();
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversationId).toBe(
      result.current.conversations[0].id,
    );
  });

  it("persists theme changes to localStorage", () => {
    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.setTheme("blue");
    });
    expect(localStorage.getItem("lotus-theme")).toBe("blue");
  });

  it("delete request → confirm removes the conversation", () => {
    const { result } = renderHook(() => useChat());
    let id = "";
    act(() => {
      id = result.current.createNewConversation();
    });
    act(() => {
      result.current.handleDeleteRequest(id);
    });
    expect(result.current.deleteConfirmId).toBe(id);
    act(() => {
      result.current.handleDeleteConfirm();
    });
    expect(result.current.conversations).toHaveLength(0);
  });
});
