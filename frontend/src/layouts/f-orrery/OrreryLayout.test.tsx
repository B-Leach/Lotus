import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrreryLayout } from "./OrreryLayout";
import { makeChatStub } from "../../test/chatStub";

describe("OrreryLayout", () => {
  it("renders messages and the mana orbs", () => {
    render(<OrreryLayout chat={makeChatStub()} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByLabelText("Islands theme")).toBeInTheDocument();
  });

  it("an orb switches the theme", async () => {
    const chat = makeChatStub();
    render(<OrreryLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("Islands theme"));
    expect(chat.setTheme).toHaveBeenCalledWith("blue");
  });

  it("sends input through the handler", async () => {
    const chat = makeChatStub();
    render(<OrreryLayout chat={chat} />);
    await userEvent.type(screen.getByPlaceholderText("Send a message..."), "Cast it{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Cast it");
  });
});
