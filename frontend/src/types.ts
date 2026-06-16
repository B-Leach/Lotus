export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  reaction?: "up" | "down" | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  mode?: "chat" | "deckbuilder";
  deckList?: string;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
}
