import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TavernLayout } from "./TavernLayout";
import { makeChatStub } from "../../test/chatStub";

describe("TavernLayout", () => {
  it("renders the keeper and messages", () => {
    render(<TavernLayout chat={makeChatStub()} />);
    expect(screen.getByText("The Keeper")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("sends input through the handler", async () => {
    const chat = makeChatStub();
    render(<TavernLayout chat={chat} />);
    await userEvent.type(screen.getByPlaceholderText("Send a message..."), "Ale, please{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Ale, please");
  });
});
