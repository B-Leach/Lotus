import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import styles from "./ChatInput.module.css";

const MAX_CHARS = 5000;

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !disabled && input.length <= MAX_CHARS) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setInput("");
      textareaRef.current?.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Allow typing but show warning if over limit
    setInput(value);
  };

  const charCount = input.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isNearLimit = charCount > MAX_CHARS * 0.9;

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <div className={styles.textareaWrapper}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className={styles.textarea}
            disabled={disabled}
            rows={1}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim() || isOverLimit}
          className={styles.sendButton}
          title="Send message"
        >
          <Send size={20} />
        </button>
      </div>
      <div className={styles.footer}>
        <p className={styles.hint}>
          Enter to send · Shift+Enter for new line · Esc to clear
        </p>
        <span
          className={`${styles.charCount} ${isOverLimit ? styles.overLimit : ""} ${isNearLimit && !isOverLimit ? styles.nearLimit : ""}`}
        >
          {charCount}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}
