import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseCardLinks } from "./cardLinks";

describe("parseCardLinks", () => {
  it("returns plain text unchanged when no card syntax present", () => {
    const parts = parseCardLinks("just text");
    render(<>{parts}</>);
    expect(screen.getByText("just text")).toBeInTheDocument();
  });

  it("renders a CardTooltip for [[card name]] tokens", () => {
    const parts = parseCardLinks("play [[Black Lotus]] now");
    render(<div>{parts}</div>);
    expect(screen.getByText("Black Lotus")).toBeInTheDocument();
    expect(screen.getByText(/play/)).toBeInTheDocument();
    expect(screen.getByText(/now/)).toBeInTheDocument();
  });
});
