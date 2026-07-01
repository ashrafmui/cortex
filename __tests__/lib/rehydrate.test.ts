import { describe, it, expect } from "vitest";
import { rebuildBlocks, rehydrateSession, type StoredSession } from "@/lib/session/rehydrate";
import { DifficultyTier, type ConceptSnapshot } from "@/lib/orchestrator/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const concept = (id: string, topic: string, mastery = 0.3): ConceptSnapshot => ({
  id,
  topic,
  parentTopic: null,
  mastery,
  difficultyTier: DifficultyTier.WORKING,
  lastReviewed: null,
  reviewInterval: 1,
  easeFactor: 2.5,
  exposureCount: 2,
});

const assistant = (mode: string, obj: unknown, topic?: string) => ({
  role: "assistant" as const,
  mode,
  concept: topic,
  content: JSON.stringify(obj),
});
const user = (mode: string, content: string, topic?: string) => ({
  role: "user" as const,
  mode,
  concept: topic,
  content,
});

const teach = { explanation: "A pointer stores an address.", check_question: "What is deref?", hints: ["h1"], concepts_introduced: [] };
const quiz = { question: "What is a dangling pointer?", rubric: "1.0 correct", hints: ["hq"] };
const grade = { score: 0.9, reasoning: "good", correct_answer: "A pointer to freed memory." };
const socOpen = { question: "Why does time matter at scale?", hints: ["s1"], guidance_direction: "growth", concepts_probed: [] };
const evalFollow = { understanding_achieved: false, follow_up_question: "What quantity grows?", hints: ["s2"], guidance_direction: "n" };
const evalDone = { understanding_achieved: true, follow_up_question: null, hints: [], guidance_direction: "" };

function makeSession(messages: unknown[], mode: string, conceptsHit: string[]): StoredSession {
  return {
    id: "sess-1",
    userId: "user-1",
    goal: "Learn",
    mode,
    messages,
    conceptsHit,
    startedAt: new Date("2020-01-01"),
    endedAt: null,
  };
}

// ── rebuildBlocks ────────────────────────────────────────────────────────────

describe("rebuildBlocks", () => {
  it("rebuilds a freshly-opened TEACH block (drops the leading goal message)", () => {
    const blocks = rebuildBlocks([
      user("TEACH", "Learn pointers", "Pointers"),
      assistant("TEACH", teach, "Pointers"),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("TEACH");
    expect(blocks[0].concept).toBe("Pointers");
    expect(blocks[0].status).toBe("active");
    expect(blocks[0].userAnswer).toBeUndefined();
  });

  it("attaches the answer and grade to a QUIZ block and marks it done", () => {
    const blocks = rebuildBlocks([
      assistant("QUIZ", quiz, "Pointers"),
      user("QUIZ", "a pointer to freed memory", "Pointers"),
      assistant("QUIZ", grade, "Pointers"),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("QUIZ");
    expect(blocks[0].userAnswer).toBe("a pointer to freed memory");
    expect(blocks[0].grade?.score).toBe(0.9);
    expect(blocks[0].quizMeta?.question).toBe(quiz.question);
    expect(blocks[0].status).toBe("done");
  });

  it("folds a mid-dialogue SOCRATIC block into turns + current follow-up", () => {
    const blocks = rebuildBlocks([
      assistant("SOCRATIC", socOpen, "Big-O"),
      user("SOCRATIC", "computers are slow", "Big-O"),
      assistant("SOCRATIC", evalFollow, "Big-O"),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("SOCRATIC");
    expect(blocks[0].socraticTurns).toEqual([
      { question: socOpen.question, userAnswer: "computers are slow" },
    ]);
    expect((blocks[0].response as { question: string }).question).toBe(evalFollow.follow_up_question);
    expect(blocks[0].status).toBe("active");
  });

  it("concludes a SOCRATIC block and starts the next block", () => {
    const blocks = rebuildBlocks([
      assistant("SOCRATIC", socOpen, "Big-O"),
      user("SOCRATIC", "final answer", "Big-O"),
      assistant("SOCRATIC", evalDone, "Big-O"),
      assistant("TEACH", teach, "Recursion"),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].mode).toBe("SOCRATIC");
    expect(blocks[0].status).toBe("done");
    expect(blocks[0].socraticTurns).toEqual([
      { question: socOpen.question, userAnswer: "final answer" },
    ]);
    expect(blocks[1].mode).toBe("TEACH");
    expect(blocks[1].status).toBe("active");
  });

  it("ignores malformed assistant JSON", () => {
    const blocks = rebuildBlocks([
      { role: "assistant", mode: "TEACH", content: "not json{" },
      assistant("TEACH", teach, "Pointers"),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("TEACH");
  });
});

// ── rehydrateSession ─────────────────────────────────────────────────────────

describe("rehydrateSession", () => {
  it("resolves currentConcept from the last assistant exchange topic", () => {
    const concepts = [concept("c1", "Pointers"), concept("c2", "Big-O")];
    const session = makeSession(
      [assistant("SOCRATIC", socOpen, "Big-O"), user("SOCRATIC", "x", "Big-O"), assistant("SOCRATIC", evalFollow, "Big-O")],
      "SOCRATIC",
      ["c2"]
    );
    const { sessionState } = rehydrateSession(session, concepts);
    expect(sessionState.currentConcept?.id).toBe("c2");
  });

  it("carries socraticTurns into the resumable state when paused mid-dialogue", () => {
    const concepts = [concept("c2", "Big-O")];
    const session = makeSession(
      [assistant("SOCRATIC", socOpen, "Big-O"), user("SOCRATIC", "vague", "Big-O"), assistant("SOCRATIC", evalFollow, "Big-O")],
      "SOCRATIC",
      ["c2"]
    );
    const { sessionState } = rehydrateSession(session, concepts);
    expect(sessionState.socraticTurns).toEqual([
      { question: socOpen.question, userAnswer: "vague" },
    ]);
  });

  it("computes exchangeCount as the trailing run in the current mode", () => {
    const concepts = [concept("c1", "Pointers")];
    const session = makeSession(
      [assistant("QUIZ", quiz, "Pointers"), user("QUIZ", "a", "Pointers"), assistant("QUIZ", grade, "Pointers")],
      "QUIZ",
      ["c1"]
    );
    const { sessionState } = rehydrateSession(session, concepts);
    expect(sessionState.totalExchanges).toBe(3);
    expect(sessionState.exchangeCount).toBe(3);
  });

  it("marks the session ended past the soft cap", () => {
    const concepts = [concept("c1", "Pointers")];
    const many = Array.from({ length: 20 }, () => user("TEACH", "x", "Pointers"));
    const { sessionEnded } = rehydrateSession(makeSession(many, "TEACH", ["c1"]), concepts);
    expect(sessionEnded).toBe(true);
  });

  it("does not mark a short session as ended", () => {
    const concepts = [concept("c1", "Pointers")];
    const session = makeSession([assistant("TEACH", teach, "Pointers")], "TEACH", ["c1"]);
    expect(rehydrateSession(session, concepts).sessionEnded).toBe(false);
  });
});
