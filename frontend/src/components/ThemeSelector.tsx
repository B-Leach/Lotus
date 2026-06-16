import { useState, useRef, useEffect } from "react";
import styles from "./ThemeSelector.module.css";

export type Theme = "default" | "white" | "blue" | "black" | "red" | "green";

interface ThemeSelectorProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const themes: {
  id: Theme;
  name: string;
  color: string;
  borderColor: string;
}[] = [
  {
    id: "default",
    name: "Magic",
    color: "#cc8030",
    borderColor: "#8c4c1c",
  },
  { id: "white", name: "Plains", color: "#f8f6d8", borderColor: "#c9a227" },
  { id: "blue", name: "Islands", color: "#0e68ab", borderColor: "#1e88e5" },
  { id: "black", name: "Swamps", color: "#2a2a2a", borderColor: "#9c27b0" },
  { id: "red", name: "Mountains", color: "#d3202a", borderColor: "#ef5350" },
  { id: "green", name: "Forests", color: "#00733e", borderColor: "#66bb6a" },
];

export function ThemeSelector({
  currentTheme,
  onThemeChange,
}: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const currentThemeData =
    themes.find((t) => t.id === currentTheme) || themes[0];

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.label}>Theme:</span>
        <span
          className={styles.currentColor}
          style={{
            backgroundColor: currentThemeData.color,
            borderColor: currentThemeData.borderColor,
          }}
        />
        <span className={styles.currentName}>{currentThemeData.name}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.open : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6,15 12,9 18,15" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          <div className={styles.dropdownHeader}>Select Theme</div>
          <div className={styles.themeGrid}>
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`${styles.themeOption} ${currentTheme === theme.id ? styles.selected : ""}`}
                onClick={() => {
                  onThemeChange(theme.id);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={currentTheme === theme.id}
                title={theme.name}
              >
                <span
                  className={styles.themeColor}
                  style={{
                    backgroundColor: theme.color,
                    borderColor: theme.borderColor,
                  }}
                />
                <span className={styles.themeName}>{theme.name}</span>
                {currentTheme === theme.id && (
                  <span className={styles.checkmark}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
