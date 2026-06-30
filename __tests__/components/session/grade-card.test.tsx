import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GradeCard } from "@/components/session/grade-card";

const base = {
  score: 0.8,
  reasoning: "The answer correctly identified the core concept.",
  correct_answer: "A stack overflow occurs when the call stack exceeds its limit.",
};

describe("GradeCard", () => {
  it("renders the score as a rounded percentage", () => {
    render(<GradeCard data={base} />);
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders the reasoning text", () => {
    render(<GradeCard data={base} />);
    expect(screen.getByText(base.reasoning)).toBeInTheDocument();
  });

  it('renders "Answer:" label with the correct answer', () => {
    render(<GradeCard data={base} />);
    expect(screen.getByText("Answer:")).toBeInTheDocument();
    expect(screen.getByText(base.correct_answer)).toBeInTheDocument();
  });

  it("applies green class for score >= 0.7", () => {
    render(<GradeCard data={{ ...base, score: 0.7 }} />);
    expect(screen.getByText("70%")).toHaveClass("text-green-600");
  });

  it("applies green class for score = 1.0", () => {
    render(<GradeCard data={{ ...base, score: 1.0 }} />);
    expect(screen.getByText("100%")).toHaveClass("text-green-600");
  });

  it("applies amber class for score in [0.4, 0.7)", () => {
    render(<GradeCard data={{ ...base, score: 0.5 }} />);
    expect(screen.getByText("50%")).toHaveClass("text-amber-600");
  });

  it("applies amber class for score = 0.4", () => {
    render(<GradeCard data={{ ...base, score: 0.4 }} />);
    expect(screen.getByText("40%")).toHaveClass("text-amber-600");
  });

  it("applies red class for score < 0.4", () => {
    render(<GradeCard data={{ ...base, score: 0.2 }} />);
    expect(screen.getByText("20%")).toHaveClass("text-red-600");
  });

  it("applies red class for score = 0", () => {
    render(<GradeCard data={{ ...base, score: 0 }} />);
    expect(screen.getByText("0%")).toHaveClass("text-red-600");
  });

  it("rounds fractional scores correctly", () => {
    render(<GradeCard data={{ ...base, score: 0.666 }} />);
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  // Documents a known visual edge: 0.695 rounds to "70%" but the colour
  // threshold check (score >= 0.7) evaluates to false, producing amber.
  it("score 0.695 displays as 70% but uses amber colour (threshold is on raw score)", () => {
    render(<GradeCard data={{ ...base, score: 0.695 }} />);
    const el = screen.getByText("70%");
    expect(el).toHaveClass("text-amber-600");
    expect(el).not.toHaveClass("text-green-600");
  });
});
