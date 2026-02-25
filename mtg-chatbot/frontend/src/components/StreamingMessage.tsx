import React from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { CardTooltip } from "./CardTooltip";
import styles from "./ChatMessage.module.css";
import streamingStyles from "./StreamingMessage.module.css";

// Convert [[card name]] syntax to CardTooltip components
function parseCardLinks(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(<CardTooltip key={match.index} cardName={match[1]} />);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

// Recursively process children to find and replace [[card name]] in text
function parseCardLinksInChildren(children: ReactNode): ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      if (child.includes("[[")) {
        return <>{parseCardLinks(child)}</>;
      }
      return child;
    }
    if (
      React.isValidElement<{ children?: ReactNode }>(child) &&
      child.props.children
    ) {
      return React.cloneElement(child, {
        children: parseCardLinksInChildren(child.props.children),
      });
    }
    return child;
  });
}

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className={`${styles.message} ${styles.assistant}`}>
      <div className={styles.content}>
        <div className={`${styles.text} ${streamingStyles.streaming}`}>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p>{parseCardLinksInChildren(children)}</p>,
              li: ({ children }) => (
                <li>{parseCardLinksInChildren(children)}</li>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
