import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HistoryView from "@/components/history/history-view";

const now = new Date("2026-06-30T12:00:00.000Z");
const later = new Date("2026-06-30T12:15:00.000Z"); // 15 min later

const makeSession = (overrides: Partial<Parameters<typeof HistoryView>[0]["sessions"][0]> = {}) => ({
  id: "session-1",
  goal: "Learn about pointers in C",
  mode: "TEACH",
  startedAt: now.toISOString(),
  endedAt: later.toISOString(),
  conceptsHit: ["concept-1", "concept-2"],
  ...overrides,
});

describe("HistoryView", () => {
  it("shows empty state when there are no sessions", () => {
    render(<HistoryView sessions={[]} />);
    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it("renders the 'Session History' heading when sessions exist", () => {
    render(<HistoryView sessions={[makeSession()]} />);
    expect(screen.getByRole("heading", { name: /session history/i })).toBeInTheDocument();
  });

  it("renders the session goal", () => {
    render(<HistoryView sessions={[makeSession()]} />);
    expect(screen.getByText("Learn about pointers in C")).toBeInTheDocument();
  });

  it("renders a human-readable mode label", () => {
    render(<HistoryView sessions={[makeSession({ mode: "TEACH" })]} />);
    expect(screen.getByText("Teach")).toBeInTheDocument();
  });

  it("falls back to raw mode string for unknown modes", () => {
    render(<HistoryView sessions={[makeSession({ mode: "UNKNOWN_MODE" })]} />);
    expect(screen.getByText("UNKNOWN_MODE")).toBeInTheDocument();
  });

  it("renders duration in minutes when endedAt is set", () => {
    render(<HistoryView sessions={[makeSession()]} />);
    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  it("omits duration when endedAt is null", () => {
    render(<HistoryView sessions={[makeSession({ endedAt: null })]} />);
    expect(screen.queryByText(/m$/)).not.toBeInTheDocument();
  });

  it("omits duration when elapsed time rounds to 0 minutes", () => {
    const sameTime = now.toISOString();
    render(<HistoryView sessions={[makeSession({ endedAt: sameTime })]} />);
    expect(screen.queryByText("0m")).not.toBeInTheDocument();
  });

  it("shows singular 'concept' for exactly one concept", () => {
    render(<HistoryView sessions={[makeSession({ conceptsHit: ["only-one"] })]} />);
    expect(screen.getByText("1 concept")).toBeInTheDocument();
  });

  it("shows plural 'concepts' for multiple concepts", () => {
    render(<HistoryView sessions={[makeSession({ conceptsHit: ["a", "b", "c"] })]} />);
    expect(screen.getByText("3 concepts")).toBeInTheDocument();
  });

  it("renders multiple sessions", () => {
    const sessions = [
      makeSession({ id: "s1", goal: "Goal A" }),
      makeSession({ id: "s2", goal: "Goal B" }),
    ];
    render(<HistoryView sessions={sessions} />);
    expect(screen.getByText("Goal A")).toBeInTheDocument();
    expect(screen.getByText("Goal B")).toBeInTheDocument();
  });
});
