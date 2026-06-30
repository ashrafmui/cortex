import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewCard } from "@/components/session/review-card";

const base = {
  question: "Explain what a stack overflow is.",
  rubric: "1.0: precise. 0.5: partial. 0.0: incorrect.",
  context_reminder: "You studied recursion last week.",
};

describe("ReviewCard", () => {
  it("renders the context reminder", () => {
    render(<ReviewCard data={base} />);
    expect(screen.getByText(base.context_reminder)).toBeInTheDocument();
  });

  it("renders the question", () => {
    render(<ReviewCard data={base} />);
    expect(screen.getByText(base.question)).toBeInTheDocument();
  });

  it("renders reminder in a muted style distinct from the question", () => {
    render(<ReviewCard data={base} />);
    const reminder = screen.getByText(base.context_reminder);
    const question = screen.getByText(base.question);
    expect(reminder).toHaveClass("text-muted-foreground");
    expect(question).not.toHaveClass("text-muted-foreground");
  });
});
