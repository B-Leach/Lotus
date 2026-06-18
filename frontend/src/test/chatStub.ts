import { vi } from "vitest";
import type { ChatController } from "../hooks/useChat";
import type { Conversation } from "../types";

export function makeConversation(partial: Partial<Conversation> = {}): Conversation {
  const now = new Date();
  return {
    id: "c1",
    title: "Test chat",
    messages: [
      { id: "m1", role: "user", content: "Hi", timestamp: now },
      { id: "m2", role: "assistant", content: "Hello, [[Black Lotus]]!", timestamp: now },
    ],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function makeChatStub(overrides: Partial<ChatController> = {}): ChatController {
  const conversation = makeConversation();
  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
    activeConversation: conversation,
    isLoading: false,
    streamingContent: "",
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    deleteConfirmId: null,
    theme: "default",
    setTheme: vi.fn(),
    createNewConversation: vi.fn(() => "new"),
    handleDeleteRequest: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleDeleteCancel: vi.fn(),
    handleSelectConversation: vi.fn(),
    handleRenameConversation: vi.fn(),
    handleReaction: vi.fn(),
    handleSendMessage: vi.fn(async () => {}),
    handleRegenerate: vi.fn(async () => {}),
    handleEditMessage: vi.fn(async () => {}),
    ...overrides,
  };
}
