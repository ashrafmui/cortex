import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeachCard } from "@/components/session/teach-card";

const base = {
  explanation: "A pointer stores a memory address.",
  check_question: "What happens when you dereference a null pointer?",
  concepts_introduced: ["null pointer", "dereference"],
};

describe("TeachCard", () => {
  it("renders the explanation", () => {
    render(<TeachCard data={base} />);
    expect(screen.getByText(base.explanation)).toBeInTheDocument();
  });

  it('renders "Check:" label followed by check_question', () => {
    render(<TeachCard data={base} />);
    expect(screen.getByText("Check:")).toBeInTheDocument();
    expect(screen.getByText(base.check_question)).toBeInTheDocument();
  });

  it("explanation element has whitespace-pre-wrap to preserve newlines", () => {
    // getByText normalises newlines, so query the <p> directly
    const { container } = render(<TeachCard data={base} />);
    const el = container.querySelector("p");
    expect(el).toHaveClass("whitespace-pre-wrap");
  });
});
