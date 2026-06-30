import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/greetings", () => ({
  getGreeting: () => "Good morning",
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("empty state", () => {
    it("renders the greeting from getGreeting()", async () => {
      render(<NewSession />);
      await screen.findByText("Good morning");
    });

    it("renders the mode selector with all four modes", () => {
      render(<NewSession />);
      expect(screen.getByRole("button", { name: /teach/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /quiz/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /socratic/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /review/i })).toBeInTheDocument();
    });

    it("renders the text input", () => {
      render(<NewSession />);
      expect(screen.getByPlaceholderText("Ask anything")).toBeInTheDocument();
    });

    it("does not submit when the input is empty", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const user = userEvent.setup();
      render(<NewSession />);
      const sendBtn = screen.getByRole("button", { name: "" }); // ArrowUp button
      await user.click(sendBtn);
      expect(fetchSpy).not.toHaveBeenCalled();
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
      await user.type(screen.getByPlaceholderText("Ask anything"), "Learn pointers");
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
      await user.type(screen.getByPlaceholderText("Ask anything"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("A pointer stores a memory address.");
    });

    it("renders the check question after a TEACH response", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Ask anything"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("What happens when you dereference a null pointer?");
    });

    it("renders the user's message as a bubble", async () => {
      vi.stubGlobal("fetch", mockFetch(teachResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Ask anything"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Learn pointers");
    });

    it("shows an error message when the API fails", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Server error" }, false));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Ask anything"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Server error");
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
      await user.type(screen.getByPlaceholderText("Ask anything"), "Quiz me on pointers");
      await user.keyboard("{Enter}");
      await screen.findByPlaceholderText("Write your answer…");
    });

    it("shows the confidence selector in quiz mode", async () => {
      vi.stubGlobal("fetch", mockFetch(quizResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Ask anything"), "Quiz me on pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Confidence:");
      expect(screen.getByRole("button", { name: /low/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /high/i })).toBeInTheDocument();
    });
  });

  describe("mode selector", () => {
    it("toggles active state when a mode is clicked", async () => {
      render(<NewSession />);
      const user = userEvent.setup();
      const quizBtn = screen.getByRole("button", { name: /quiz/i });
      await user.click(quizBtn);
      // After clicking Quiz, it should become active (primary background)
      expect(quizBtn).toHaveClass("bg-primary");
    });
  });
});
