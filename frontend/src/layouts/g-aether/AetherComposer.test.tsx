import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AetherComposer } from "./AetherComposer";

const PLACEHOLDER = "Ask anything, or paste a deck list…";

describe("AetherComposer", () => {
  it("sends trimmed text on Enter and clears", async () => {
    const onSend = vi.fn();
    render(<AetherComposer onSend={onSend} disabled={false} />);
    const box = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;
    await userEvent.type(box, "  hello  {enter}");
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(box.value).toBe("");
  });

  it("Shift+Enter inserts a newline and does not send", async () => {
    const onSend = vi.fn();
    render(<AetherComposer onSend={onSend} disabled={false} />);
    const box = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(box, "line{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables the send button while loading", () => {
    render(<AetherComposer onSend={vi.fn()} disabled={true} />);
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });
});
