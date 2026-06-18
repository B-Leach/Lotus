import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardsLayout } from "./CardsLayout";
import { makeChatStub, makeConversation } from "../../test/chatStub";

describe("CardsLayout", () => {
  it("renders assistant message inside a card and user as token", () => {
    render(<CardsLayout chat={makeChatStub()} />);
    expect(screen.getByText("Lotus")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByText("Hi").closest("article")).toBeNull();
  });

  it("sends input through the chat handler", async () => {
    const chat = makeChatStub();
    render(<CardsLayout chat={chat} />);
    const box = screen.getByPlaceholderText("Send a message...");
    await userEvent.type(box, "Build me a deck{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Build me a deck");
  });

  it("opens and closes the expanded reading overlay", async () => {
    const long = "L".repeat(400);
    const conversation = makeConversation({
      messages: [
        { id: "m1", role: "assistant", content: long, timestamp: new Date() },
      ],
    });
    const chat = makeChatStub({
      conversations: [conversation],
      activeConversationId: conversation.id,
      activeConversation: conversation,
    });
    render(<CardsLayout chat={chat} />);
    await userEvent.click(screen.getByRole("button", { name: "Read full response" }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
