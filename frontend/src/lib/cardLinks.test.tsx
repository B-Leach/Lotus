import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseCardLinks, parseCardLinksInChildren } from "./cardLinks";

describe("cardLinks", () => {
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

describe("parseCardLinksInChildren", () => {
  it("processes [[card name]] nested inside an element child", () => {
    const out = parseCardLinksInChildren(<p>tap <strong>[[Sol Ring]]</strong></p>);
    render(<>{out}</>);
    expect(screen.getByText("Sol Ring")).toBeInTheDocument();
    expect(screen.getByText(/tap/)).toBeInTheDocument();
  });

  it("passes through a plain string child with no card syntax unchanged", () => {
    const out = parseCardLinksInChildren("plain");
    render(<>{out}</>);
    expect(screen.getByText("plain")).toBeInTheDocument();
  });

  it("leaves an element child with no [[ ]] intact", () => {
    const out = parseCardLinksInChildren(<em>just text</em>);
    render(<>{out}</>);
    expect(screen.getByText("just text")).toBeInTheDocument();
  });
});
