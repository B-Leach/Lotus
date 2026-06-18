import ReactMarkdown from "react-markdown";
import { parseCardLinksInChildren } from "../lib/cardLinks";

interface MessageBodyProps {
  content: string;
}

export function MessageBody({ content }: MessageBodyProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p>{parseCardLinksInChildren(children)}</p>,
        li: ({ children }) => <li>{parseCardLinksInChildren(children)}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
