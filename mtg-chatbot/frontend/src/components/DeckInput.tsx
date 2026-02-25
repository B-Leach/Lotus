import { useState, useRef, useEffect } from "react";
import { Send, FileText } from "lucide-react";
import styles from "./DeckInput.module.css";

interface DeckInputProps {
  onSubmit: (deckList: string, message: string) => void;
  disabled: boolean;
}

export function DeckInput({ onSubmit, disabled }: DeckInputProps) {
  const [deckList, setDeckList] = useState("");
  const [message, setMessage] = useState("Please analyze my deck and suggest improvements.");
  const deckTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (deckTextareaRef.current) {
      deckTextareaRef.current.style.height = "auto";
      deckTextareaRef.current.style.height = `${Math.min(deckTextareaRef.current.scrollHeight, 400)}px`;
    }
  }, [deckList]);

  const handleSubmit = () => {
    if (deckList.trim() && message.trim() && !disabled) {
      onSubmit(deckList.trim(), message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const cardCount = (deckList.match(/^\d+/gm) || []).reduce(
    (sum, n) => sum + parseInt(n, 10),
    0
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <FileText size={20} />
        <span>Deck Builder Mode</span>
      </div>

      <div className={styles.deckSection}>
        <label className={styles.label}>Paste your deck list</label>
        <textarea
          ref={deckTextareaRef}
          value={deckList}
          onChange={(e) => setDeckList(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Commander
1 Kudo, King Among Bears

Mainboard
1 Sol Ring
1 Arcane Signet
4 Forest
...`}
          className={styles.deckTextarea}
          disabled={disabled}
          rows={10}
        />
        <div className={styles.deckFooter}>
          <span className={styles.cardCount}>
            {cardCount > 0 ? `${cardCount} cards detected` : "Paste your deck list above"}
          </span>
          <span className={styles.formatHint}>
            Supports MTGO, Arena, Moxfield formats
          </span>
        </div>
      </div>

      <div className={styles.messageSection}>
        <label className={styles.label}>What would you like help with?</label>
        <div className={styles.messageWrapper}>
          <input
            ref={messageInputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Help me cut 10 cards, or What's my mana curve like?"
            className={styles.messageInput}
            disabled={disabled}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !deckList.trim() || !message.trim()}
            className={styles.submitButton}
            title="Analyze deck (Cmd+Enter)"
          >
            <Send size={20} />
            <span>Analyze</span>
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        Cmd+Enter to submit
      </p>
    </div>
  );
}
