import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: "sess-1" }),
  usePathname: () => "/new-session/sess-1",
  useSearchParams: () => new URLSearchParams(),
}));

import SessionPage from "@/app/(app)/new-session/[sessionId]/page";

function mockGet(payload: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(payload) });
}

const baseState = {
  sessionId: "sess-1",
  userId: "user-1",
  goal: "Learn pointers",
  currentMode: "TEACH",
  currentConcept: { id: "c1", topic: "Pointers", mastery: 0.2 },
  exchangeCount: 1,
  totalExchanges: 2,
  conceptsHit: ["c1"],
  exchanges: [],
  socraticTurns: [],
  startedAt: new Date().toISOString(),
};

describe("SessionPage (rehydration)", () => {
  beforeEach(() => pushMock.mockReset());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads the session and renders the TEACH block content", async () => {
    vi.stubGlobal(
      "fetch",
      mockGet({
        goal: "Learn pointers",
        sessionState: baseState,
        sessionEnded: false,
        blocks: [
          {
            id: "b0",
            mode: "TEACH",
            concept: "Pointers",
            difficulty: "foundation",
            response: { explanation: "A pointer stores an address.", check_question: "What is deref?", hints: [] },
            hints: [],
            status: "active",
          },
        ],
      })
    );
    render(<SessionPage />);
    await screen.findByText("A pointer stores an address.");
    expect(screen.getByText("Learn pointers")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your response…")).toBeInTheDocument();
  });

  it("shows a Continue button for a rehydrated graded block (resume mid-session)", async () => {
    vi.stubGlobal(
      "fetch",
      mockGet({
        goal: "Learn pointers",
        sessionState: { ...baseState, currentMode: "QUIZ" },
        sessionEnded: false,
        blocks: [
          {
            id: "b0",
            mode: "QUIZ",
            concept: "Pointers",
            difficulty: "foundation",
            response: { question: "What is a dangling pointer?", rubric: "r", hints: [] },
            hints: [],
            quizMeta: { question: "What is a dangling pointer?", rubric: "r" },
            userAnswer: "a pointer to freed memory",
            grade: { score: 0.9, reasoning: "good", correct_answer: "A pointer to freed memory." },
            status: "done",
          },
        ],
      })
    );
    render(<SessionPage />);
    await screen.findByRole("button", { name: /continue/i });
    // The graded answer and correct answer are shown too.
    expect(screen.getByText("a pointer to freed memory")).toBeInTheDocument();
  });

  it("renders an error state with a way back when the session fails to load", async () => {
    vi.stubGlobal("fetch", mockGet({ error: "Session not found" }, false));
    render(<SessionPage />);
    await screen.findByText("Session not found");
    expect(screen.getByRole("button", { name: /back to new session/i })).toBeInTheDocument();
  });
});
