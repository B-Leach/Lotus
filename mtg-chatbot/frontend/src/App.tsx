import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { type Theme } from "./components/ThemeSelector";
import { sendMessageStream } from "./api";
import type { Conversation, Message } from "./types";
import "./App.css";

const STORAGE_KEY = "lotus-conversations";
const ACTIVE_CHAT_KEY = "lotus-active-chat";
const THEME_KEY = "lotus-theme";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const conversations = parsed.map((conv: Conversation) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt || conv.createdAt),
        messages: conv.messages.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          reaction: msg.reaction || null,
        })),
      }));
      // Sort by most recently updated
      return conversations.sort(
        (a: Conversation, b: Conversation) =>
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    }
  } catch (error) {
    console.error("Failed to load conversations:", error);
  }
  return [];
}

function loadActiveConversationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHAT_KEY);
  } catch (error) {
    console.error("Failed to load active conversation:", error);
  }
  return null;
}

function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error("Failed to save conversations:", error);
  }
}

function saveActiveConversationId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CHAT_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CHAT_KEY);
    }
  } catch (error) {
    console.error("Failed to save active conversation:", error);
  }
}

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (
      stored &&
      ["default", "white", "blue", "black", "red", "green"].includes(stored)
    ) {
      return stored as Theme;
    }
  } catch (error) {
    console.error("Failed to load theme:", error);
  }
  return "default";
}

function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Failed to save theme:", error);
  }
}

function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations(),
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(() => {
    const savedActiveId = loadActiveConversationId();
    const loaded = loadConversations();
    // Use saved active ID if it exists and is valid, otherwise use first conversation
    if (savedActiveId && loaded.some((c) => c.id === savedActiveId)) {
      return savedActiveId;
    }
    return loaded.length > 0 ? loaded[0].id : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const streamingMessageId = useRef<string | null>(null);
  const lastUserMessage = useRef<string>("");

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Save active conversation ID whenever it changes
  useEffect(() => {
    saveActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  // Apply theme to document with transition
  useEffect(() => {
    document.documentElement.classList.add("theme-transitioning");
    if (theme === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    saveTheme(theme);
    const timeout = setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 500);
    return () => clearTimeout(timeout);
  }, [theme]);

  // Dynamic favicon tinting based on theme
  useEffect(() => {
    const themeColors: Record<Theme, { accent: string; bg: string }> = {
      default: { accent: "#cc8030", bg: "#1a1209" },
      white: { accent: "#c9a227", bg: "#f5f0e6" },
      blue: { accent: "#1e88e5", bg: "#0a1929" },
      black: { accent: "#9c27b0", bg: "#0d0d0d" },
      red: { accent: "#e53935", bg: "#1a0a08" },
      green: { accent: "#43a047", bg: "#0a1a0d" },
    };

    const { accent, bg } = themeColors[theme];
    const img = new Image();
    img.src = "/logo.png";
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw rounded background
      const radius = 12;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fillStyle = bg;
      ctx.fill();

      // Draw logo onto a temporary canvas to tint it
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      const padding = 8;
      const logoSize = size - padding * 2;
      tempCtx.drawImage(img, padding, padding, logoSize, logoSize);
      const imageData = tempCtx.getImageData(0, 0, size, size);
      const data = imageData.data;

      const r = parseInt(accent.slice(1, 3), 16);
      const g = parseInt(accent.slice(3, 5), 16);
      const b = parseInt(accent.slice(5, 7), 16);

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      // Composite tinted logo onto background
      ctx.drawImage(tempCanvas, 0, 0);

      const link =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
        document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");
      if (!link.parentElement) {
        document.head.appendChild(link);
      }
    };
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        createNewConversation();
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );

  const createNewConversation = useCallback(() => {
    const now = new Date();
    const newConversation: Conversation = {
      id: generateId(),
      title: "New conversation",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    return newConversation.id;
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmId) {
      setConversations((prev) => prev.filter((c) => c.id !== deleteConfirmId));
      if (activeConversationId === deleteConfirmId) {
        const remaining = conversations.filter((c) => c.id !== deleteConfirmId);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, activeConversationId, conversations]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      // Remove the current conversation if it's empty (no messages)
      setConversations((prev) => {
        const currentConv = prev.find((c) => c.id === activeConversationId);
        if (
          currentConv &&
          currentConv.messages.length === 0 &&
          activeConversationId !== id
        ) {
          return prev.filter((c) => c.id !== activeConversationId);
        }
        return prev;
      });
      setActiveConversationId(id);
      setSidebarOpen(false);
    },
    [activeConversationId],
  );

  const handleRenameConversation = useCallback(
    (id: string, newTitle: string) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id ? { ...conv, title: newTitle } : conv,
        ),
      );
    },
    [],
  );

  const handleReaction = useCallback(
    (messageId: string, reaction: "up" | "down" | null) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === activeConversationId) {
            return {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, reaction } : msg,
              ),
            };
          }
          return conv;
        }),
      );
    },
    [activeConversationId],
  );

  const sendMessageToAPI = useCallback(
    async (
      content: string,
      conversationId: string,
      isRegenerate: boolean = false,
    ) => {
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const assistantMessageId = generateId();
      streamingMessageId.current = assistantMessageId;
      lastUserMessage.current = content;

      if (!isRegenerate) {
        // Update conversation and move it to the top (most recent)
        setConversations((prev) => {
          const updated = prev.map((conv) => {
            if (conv.id === conversationId) {
              const updatedMessages = [...conv.messages, userMessage];
              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: new Date(),
                title:
                  conv.messages.length === 0
                    ? content.slice(0, 30) + (content.length > 30 ? "..." : "")
                    : conv.title,
              };
            }
            return conv;
          });
          return updated.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        });
      } else {
        // For regenerate, immediately remove the last assistant message
        setConversations((prev) => {
          const updated = prev.map((conv) => {
            if (conv.id === conversationId) {
              let messages = conv.messages;
              if (
                messages.length > 0 &&
                messages[messages.length - 1].role === "assistant"
              ) {
                messages = messages.slice(0, -1);
              }
              return {
                ...conv,
                messages,
                updatedAt: new Date(),
              };
            }
            return conv;
          });
          return updated.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        });
      }

      setIsLoading(true);
      setStreamingContent("");

      try {
        const currentConv = conversations.find((c) => c.id === conversationId);
        let history =
          currentConv?.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })) || [];

        // For regenerate, remove the last assistant message from history
        if (
          isRegenerate &&
          history.length > 0 &&
          history[history.length - 1].role === "assistant"
        ) {
          history = history.slice(0, -1);
        }

        let fullContent = "";

        await sendMessageStream(
          {
            message: content,
            conversationHistory: history,
            conversationId,
          },
          (chunk) => {
            fullContent += chunk;
            setStreamingContent(fullContent);
          },
        );

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: fullContent,
          timestamp: new Date(),
        };

        setConversations((prev) => {
          const updated = prev.map((conv) => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                messages: [...conv.messages, assistantMessage],
                updatedAt: new Date(),
              };
            }
            return conv;
          });
          return updated.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content:
            "Sorry, I encountered an error while connecting to the server. Please try again.",
          timestamp: new Date(),
        };

        setConversations((prev) => {
          const updated = prev.map((conv) => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                messages: [...conv.messages, errorMessage],
                updatedAt: new Date(),
              };
            }
            return conv;
          });
          return updated.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        });
      } finally {
        setIsLoading(false);
        setStreamingContent("");
        streamingMessageId.current = null;
      }
    },
    [conversations],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      let conversationId = activeConversationId;

      if (!conversationId) {
        conversationId = createNewConversation();
      }

      await sendMessageToAPI(content, conversationId, false);
    },
    [activeConversationId, createNewConversation, sendMessageToAPI],
  );

  const handleRegenerate = useCallback(async () => {
    if (!activeConversationId || !activeConversation) return;

    // Find the last user message
    const messages = activeConversation.messages;
    let lastUserMsg = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMsg = messages[i].content;
        break;
      }
    }

    if (lastUserMsg) {
      await sendMessageToAPI(lastUserMsg, activeConversationId, true);
    }
  }, [activeConversationId, activeConversation, sendMessageToAPI]);

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeConversationId || !activeConversation) return;

      // Find the index of the message being edited
      const messageIndex = activeConversation.messages.findIndex(
        (msg) => msg.id === messageId,
      );
      if (messageIndex === -1) return;

      // Remove all messages from this point forward (including the edited message and its response)
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === activeConversationId) {
            return {
              ...conv,
              messages: conv.messages.slice(0, messageIndex),
              updatedAt: new Date(),
            };
          }
          return conv;
        }),
      );

      // Send the new message
      await sendMessageToAPI(newContent, activeConversationId, false);
    },
    [activeConversationId, activeConversation, sendMessageToAPI],
  );

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={createNewConversation}
        onDelete={handleDeleteRequest}
        onRename={handleRenameConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
      <ChatArea
        messages={activeConversation?.messages || []}
        isLoading={isLoading}
        streamingContent={streamingContent}
        onSendMessage={handleSendMessage}
        onMenuClick={() => setSidebarOpen(true)}
        hasConversations={conversations.length > 0}
        onNewChat={createNewConversation}
        onRegenerate={handleRegenerate}
        onReaction={handleReaction}
        onEditMessage={handleEditMessage}
      />
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete conversation?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleDeleteCancel}>
                Cancel
              </button>
              <button className="modal-confirm" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
