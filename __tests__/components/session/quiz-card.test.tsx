import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizCard } from "@/components/session/quiz-card";

const base = {
  question: "Explain what a stack overflow is.",
  rubric: "1.0: precise. 0.5: partial. 0.0: incorrect.",
  hints: ["Think about the call stack.", "Consider recursion without a base case."],
};

describe("QuizCard", () => {
  it("renders the question", () => {
    render(<QuizCard data={base} />);
    expect(screen.getByText(base.question)).toBeInTheDocument();
  });

  it("shows hints toggle button when hints are present", () => {
    render(<QuizCard data={base} />);
    expect(screen.getByRole("button", { name: /show hints/i })).toBeInTheDocument();
  });

  it("does not show a hints button when hints array is empty", () => {
    render(<QuizCard data={{ ...base, hints: [] }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reveals hints list on click", async () => {
    const user = userEvent.setup();
    render(<QuizCard data={base} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show hints/i }));
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(base.hints.length);
  });

  it("hides hints list on second click", async () => {
    const user = userEvent.setup();
    render(<QuizCard data={base} />);
    const btn = screen.getByRole("button", { name: /show hints/i });
    await user.click(btn);
    await user.click(screen.getByRole("button", { name: /hide hints/i }));
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("does not crash when hints field is missing (LLM omission)", () => {
    // Cast to simulate a malformed LLM response missing the hints field
    const data = { question: base.question, rubric: base.rubric } as typeof base;
    expect(() => render(<QuizCard data={data} />)).not.toThrow();
  });
});
