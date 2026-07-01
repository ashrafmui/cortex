import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/greetings", () => ({
  getGreeting: () => "Good morning",
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/new-session",
  useSearchParams: () => new URLSearchParams(),
}));

import NewSession from "@/app/(app)/new-session/page";

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  });
}

describe("NewSession picker page", () => {
  beforeEach(() => {
    pushMock.mockReset();
    // Default stub — concepts fetch returns empty list; tests override as needed.
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
      expect(fetchSpy).not.toHaveBeenCalledWith("/api/session/start", expect.anything());
    });
  });

  describe("starting a session", () => {
    const startResponse = {
      sessionState: { sessionId: "sess-1", userId: "user-1" },
      mode: "TEACH",
      difficulty: "foundation",
      response: { explanation: "x", check_question: "y", hints: [] },
    };

    it("calls /api/session/start with the user's goal on submit", async () => {
      const fetchSpy = mockFetch(startResponse);
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

    it("redirects to the new session's page after starting", async () => {
      vi.stubGlobal("fetch", mockFetch(startResponse));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/new-session/sess-1"));
    });

    it("shows an error and stays on the picker when start fails", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Server error" }, false));
      const user = userEvent.setup();
      render(<NewSession />);
      await user.type(screen.getByPlaceholderText("Describe what you want to learn…"), "Learn pointers");
      await user.keyboard("{Enter}");
      await screen.findByText("Server error");
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
