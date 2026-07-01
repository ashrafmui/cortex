import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/greetings", () => ({
  getGreeting: () => "Good morning",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/new-session",
  useSearchParams: () => new URLSearchParams(),
}));

import NewSession from "@/app/(app)/new-session/page";

// ── Shared fetch mock helpers ────────────────────────────────────────────────

const minimalSessionState = {
  sessionId: "sess-1",
  userId: "user-1",
  goal: "Learn pointers",
  currentMode: "TEACH",
  currentConcept: { id: "c1", topic: "Pointers", parentTopic: null, mastery: 0, difficultyTier: "foundation", lastReviewed: null, reviewInterval: 1, easeFactor: 2.5, exposureCount: 0 },
  exchangeCount: 2,
  totalExchanges: 2,
  conceptsHit: ["c1"],
  exchanges: [],
  startedAt: new Date().toISOString(),
};

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("NewSession page", () => {
  beforeEach(() => {
    // Default stub — concepts fetch returns empty list; individual tests override as needed
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ concepts: [] }) })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("empty state", () => {
    it("renders the greeting from getGreeting()", async () => {
      render(<NewSession />);
      await screen.findByText("Good morning");
    });

    it("renders the goal input", () => {
      render(<NewSession />);
      expect(screen.getByPlaceholderText("Describe what you want to learn…")).toBeInTheDocument();
    });

    it("does not render mode selector buttons", () => {
      render(<NewSession />);
      expect(screen.queryByRole("button", { name: /teach/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /quiz/i })).not.toBeInTheDocument();
    });

    it("does not submit when the input is empty", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ concepts: [] }),
      });
      vi.stubGlobal("fetch", fetchSpy);
      const user = userEvent.setup();
      render(<NewSession />);
      const sendBtn = screen.getByRole("button", { name: "" }); // ArrowUp button
      await user.click(sendBtn);
      expect(fetchSpy).not.toHaveBeenCalledWith(
        "/api/session/start",
        expect.anything()
      );
    });
  });

  describe("TEACH session flow", () => {
    const teachResponse = {
      sessionState: minimalSessionState,
      mode: "TEACH",
      difficulty: "foundation",
      response: {
        explanation: "A pointer stores a memory address.",
        check_question: "What happens when you dereference a null pointer?",
        concepts_introduced: ["null pointer"],
      },
    };

    it("calls /api/session/start with the user's goal on first submit", async () => {
      const fetchSpy = mockFetch(teachResponse);
      vi.stubGlobal("fetch", fetchSpy);
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/session/start",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ goal: "Learn pointers" }),
        })
      );
    });

    it("renders the AI explanation after a TEACH response", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("A pointer stores a memory address.");
    });

    it("renders the check question after a TEACH response", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("What happens when you dereference a null pointer?");
    });

    it("shows the goal in the session header after starting", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Learn pointers");
    });

    it("shows the mode badge for the current block", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Teaching");
    });

    it("shows an error message when the API fails", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Server error" }, false));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Server error");
    });

    it("shows inline text input inside the active TEACH block", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByPlaceholderText("Your response…");
    });
  });

  describe("QUIZ session flow", () => {
    const quizResponse = {
      sessionState: minimalSessionState,
      mode: "QUIZ",
      difficulty: "foundation",
      response: {
        question: "What is a dangling pointer?",
        rubric: "1.0: correct. 0.0: wrong.",
        hints: ["Think about freed memory."],
      },
    };

    it("switches to quiz input when the session enters QUIZ mode", async () => {
      vi.stubGlobal("fetch", mockFetch(quizResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Quiz me on pointers");
      await user.keyboard("{Enter}");
      await screen.findByPlaceholderText("Write your answer…");
    });

    it("shows the confidence selector in quiz mode", async () => {
      vi.stubGlobal("fetch", mockFetch(quizResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Quiz me on pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Confidence:");
      expect(screen.getByRole("button", { name: /low/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /high/i })).toBeInTheDocument();
    });

    it("shows the Quiz mode badge in the block header", async () => {
      vi.stubGlobal("fetch", mockFetch(quizResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Quiz me on pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Quiz");
    });
  });
});
