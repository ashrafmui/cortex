import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocraticCard } from "@/components/session/socratic-card";

const base = {
  question: "What assumption is this concept built on?",
  guidance_direction: "Toward recognising the underlying invariant.",
  concepts_probed: ["invariant"],
};

describe("SocraticCard", () => {
  it("renders the question text", () => {
    render(<SocraticCard data={base} />);
    expect(screen.getByText(base.question)).toBeInTheDocument();
  });

  it("renders the question in an italic element", () => {
    render(<SocraticCard data={base} />);
    const el = screen.getByText(base.question);
    expect(el).toHaveClass("italic");
  });
});
