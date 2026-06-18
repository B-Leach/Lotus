import React from "react";
import type { ReactNode } from "react";
import { CardTooltip } from "../components/CardTooltip";

export function parseCardLinks(content: string): ReactNode[] {
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

export function parseCardLinksInChildren(children: ReactNode): ReactNode {
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
