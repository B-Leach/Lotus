import { MessageBody } from "./MessageBody";
import styles from "./ChatMessage.module.css";
import streamingStyles from "./StreamingMessage.module.css";

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className={`${styles.message} ${styles.assistant}`}>
      <div className={styles.content}>
        <div className={`${styles.text} ${streamingStyles.streaming}`}>
          <MessageBody content={content} />
        </div>
      </div>
    </div>
  );
}
