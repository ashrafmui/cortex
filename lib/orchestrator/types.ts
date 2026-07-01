// ============================================================================
// Cortex Session Orchestrator — Type Definitions
// ============================================================================

/** The four learning modes the orchestrator can select. */
export enum SessionMode {
  TEACH = "TEACH",
  QUIZ = "QUIZ",
  SOCRATIC = "SOCRATIC",
  REVIEW = "REVIEW",
}

/** Mastery-based difficulty tiers, ordered by progression. */
export enum DifficultyTier {
  FOUNDATION = "foundation",
  WORKING = "working",
  DEEP = "deep",
  APPLIED = "applied",
}

/** Self-reported confidence on quiz answers. */
export enum Confidence {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

// ============================================================================
// Learner Model Types
// ============================================================================

/** A single concept node in the learner's knowledge graph. */
export interface ConceptNode {
  id: string;
  userId: string;
  topic: string;
  parentTopic: string | null;
  mastery: number; // 0.0 – 1.0
  difficultyTier: DifficultyTier;
  lastReviewed: Date | null;
  reviewInterval: number; // days (SM-2 interval)
  easeFactor: number; // SM-2 ease factor, default 2.5
  exposureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Lightweight concept reference used during orchestration (avoids full DB shape). */
export interface ConceptSnapshot {
  id: string;
  topic: string;
  parentTopic: string | null;
  mastery: number;
  difficultyTier: DifficultyTier;
  lastReviewed: Date | null;
  reviewInterval: number;
  easeFactor: number;
  exposureCount: number;
}

// ============================================================================
// Session Types
// ============================================================================

/** A single exchange within a session (user message + AI response). */
export interface SessionExchange {
  role: "user" | "assistant";
  content: string;
  mode: SessionMode;
  concept?: string; // topic of the concept this exchange was about (for rehydration)
  timestamp: Date;
}

/** One completed question/answer pair inside an ongoing Socratic dialogue. */
export interface SocraticTurn {
  question: string;
  userAnswer: string;
}

/** Running state of an active session, held in memory during the session. */
export interface SessionState {
  sessionId: string;
  userId: string;
  goal: string;
  currentMode: SessionMode;
  currentConcept: ConceptSnapshot | null;
  exchangeCount: number; // exchanges in the current mode
  totalExchanges: number; // total exchanges this session
  conceptsHit: string[]; // concept IDs touched so far
  exchanges: SessionExchange[];
  /** Completed Q/A pairs within the current SOCRATIC block; reset when the block concludes. */
  socraticTurns?: SocraticTurn[];
  startedAt: Date;
}

// ============================================================================
// Orchestrator Decision Types
// ============================================================================

/** The orchestrator's decision for the next action in the session. */
export interface OrchestratorDecision {
  mode: SessionMode;
  concept: ConceptSnapshot;
  difficultyTier: DifficultyTier;
  reason: string; // human-readable explanation for debugging
}

/** Output of the prompt constructor — ready to send to the LLM. */
export interface ConstructedPrompt {
  systemPrompt: string;
  mode: SessionMode;
  concept: ConceptSnapshot;
  difficultyTier: DifficultyTier;
}

// ============================================================================
// SM-2 Types
// ============================================================================

/** Quality rating for SM-2 (mapped from quiz score). */
export type SM2Quality = 0 | 1 | 2 | 3 | 4 | 5;

/** Result of an SM-2 interval calculation. */
export interface SM2Result {
  interval: number; // new interval in days
  easeFactor: number; // updated ease factor
  nextReviewDate: Date;
}

// ============================================================================
// LLM Response Schemas (expected JSON shapes from the LLM)
// ============================================================================

export interface TeachResponse {
  explanation: string;
  check_question: string;
  hints: string[];
  concepts_introduced: string[];
}

export interface QuizResponse {
  question: string;
  rubric: string;
  hints: string[];
}

export interface QuizGradeResponse {
  score: number; // 0.0 – 1.0
  reasoning: string;
  correct_answer: string;
}

export interface SocraticResponse {
  question: string;
  hints: string[];
  guidance_direction: string; // what the question is leading toward
  concepts_probed: string[];
}

/** LLM verdict after a learner replies mid-Socratic dialogue. */
export interface SocraticEvalResponse {
  understanding_achieved: boolean; // true → conclude the block and move on
  follow_up_question: string | null; // next question if not yet understood
  hints: string[]; // stepping-stone hints for the follow-up
  guidance_direction: string; // what the follow-up leads toward
}

export interface ReviewResponse {
  question: string;
  rubric: string;
  hints: string[];
  context_reminder: string; // brief recap to jog memory
}
