import { useState, useRef, useEffect } from "react";
import {
  MessageSquarePlus,
  Trash2,
  X,
  Search,
  Pencil,
  Check,
} from "lucide-react";
import type { Conversation } from "../types";
import { ThemeSelector, type Theme } from "./ThemeSelector";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  isOpen,
  onClose,
  theme,
  onThemeChange,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.messages.some((msg) =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  const handleStartEdit = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(id);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <div className={styles.titleLogo} />
            Lotus
          </h1>
          <div className={styles.headerButtons}>
            <button
              onClick={onNew}
              className={styles.newButton}
              title="New conversation (Ctrl+N)"
            >
              <MessageSquarePlus size={20} />
            </button>
            <button
              onClick={onClose}
              className={styles.closeButton}
              title="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              className={styles.clearSearch}
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <nav className={styles.conversations}>
          {conversations.length === 0 ? (
            <p className={styles.empty}>No conversations yet</p>
          ) : filteredConversations.length === 0 ? (
            <p className={styles.empty}>No matching conversations</p>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`${styles.conversation} ${conv.id === activeId ? styles.active : ""}`}
                onClick={() => onSelect(conv.id)}
              >
                {editingId === conv.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                    onBlur={() => handleSaveEdit(conv.id)}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.editInput}
                  />
                ) : (
                  <span className={styles.convTitle}>{conv.title}</span>
                )}
                <div className={styles.convActions}>
                  {editingId === conv.id ? (
                    <>
                      <button
                        className={styles.actionButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit(conv.id);
                        }}
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.cancelButton}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.actionButton}
                        onClick={(e) => handleStartEdit(conv, e)}
                        title="Rename conversation"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(conv.id);
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </nav>

        <div className={styles.footer}>
          <ThemeSelector currentTheme={theme} onThemeChange={onThemeChange} />
          <p className={styles.disclaimer}>
            Every conversation leads to Magic: The Gathering
          </p>
          <p className={styles.shortcut}>Ctrl+N: New chat</p>
        </div>
      </aside>
    </>
  );
}
