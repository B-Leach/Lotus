import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AetherLayout } from "./AetherLayout";
import { makeChatStub } from "../../test/chatStub";

const PLACEHOLDER = "Ask anything, or paste a deck list…";

describe("AetherLayout", () => {
  it("renders assistant text and the user message", () => {
    render(<AetherLayout chat={makeChatStub()} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Black Lotus")).toBeInTheDocument();
  });

  it("a mana dot switches the theme", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("Islands theme"));
    expect(chat.setTheme).toHaveBeenCalledWith("blue");
  });

  it("sends from the composer", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Cast it{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Cast it");
  });

  it("opens history and selects a conversation", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("History"));
    await userEvent.click(screen.getByText("Test chat"));
    expect(chat.handleSelectConversation).toHaveBeenCalledWith("c1");
  });

  it("toggles the body.aether class on mount/unmount", () => {
    const { unmount } = render(<AetherLayout chat={makeChatStub()} />);
    expect(document.body.classList.contains("aether")).toBe(true);
    unmount();
    expect(document.body.classList.contains("aether")).toBe(false);
  });

  it("closes the history panel on Escape", async () => {
    const user = userEvent.setup();
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await user.click(screen.getByLabelText("History"));
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Conversations")).not.toBeInTheDocument();
  });

  it("shows the welcome state when there are no messages", () => {
    const chat = makeChatStub();
    chat.activeConversation!.messages = [];
    chat.conversations[0].messages = [];
    render(<AetherLayout chat={chat} />);
    expect(screen.getByText("Ask me anything")).toBeInTheDocument();
  });
});
