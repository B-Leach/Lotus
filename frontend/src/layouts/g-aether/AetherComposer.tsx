import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import styles from "./styles.module.css";

interface AetherComposerProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function AetherComposer({ onSend, disabled }: AetherComposerProps) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const submit = () => {
    const text = input.trim();
    if (text && !disabled) {
      onSend(text);
      setInput("");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setInput("");
      ref.current?.blur();
    }
  };

  return (
    <div className={styles.composer}>
      <textarea
        ref={ref}
        className={styles.composerInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything, or paste a deck list…"
        rows={1}
        disabled={disabled}
      />
      <button
        className={styles.sendBtn}
        onClick={submit}
        disabled={disabled || !input.trim()}
        aria-label="Send message"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
