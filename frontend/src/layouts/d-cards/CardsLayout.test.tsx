import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardsLayout } from "./CardsLayout";
import { makeChatStub } from "../../test/chatStub";

describe("CardsLayout", () => {
  it("renders assistant message inside a card and user as token", () => {
    render(<CardsLayout chat={makeChatStub()} />);
    expect(screen.getByText("Lotus")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("sends input through the chat handler", async () => {
    const chat = makeChatStub();
    render(<CardsLayout chat={chat} />);
    const box = screen.getByPlaceholderText("Send a message...");
    await userEvent.type(box, "Build me a deck{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Build me a deck");
  });
});
