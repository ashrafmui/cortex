// ============================================================================
// Cortex Session Orchestrator — Main Entry Point
// ============================================================================
// This is the "brain" of Cortex. API routes call this module to:
//
//   1. Start a session  → initSession()
//   2. Get next action   → getNextAction()   (mode + prompt for the LLM)
//   3. Process a quiz    → processQuizResult() (score → mastery update → SM-2)
//   4. Record exchange   → recordExchange()   (track conversation history)
//
// The orchestrator is stateless between calls — session state is passed in
// and returned. Persistence is the caller's responsibility (API route → DB).
// ============================================================================

import {
  SessionMode,
  DifficultyTier,
  type ConceptSnapshot,
  type SessionState,
  type SessionExchange,
  type OrchestratorDecision,
  type ConstructedPrompt,
} from "./types";
import {
  calculateSM2,
  scoreToQuality,
  updateMastery,
  decayMastery,
  isDueForReview,
  reviewUrgency,
} from "./sm2";
import {
  makeDecision,
  selectNextConcept,
  shouldTransition,
} from "./mode-selector";
import { constructPrompt, constructGradePrompt } from "./prompt-constructor";

// ============================================================================
// Session Lifecycle
// ============================================================================

/**
 * Initialize a new learning session.
 *
 * Call this when the user starts a session with a learning goal.
 * Returns the initial session state and the first LLM prompt.
 */
export function initSession(
  sessionId: string,
  userId: string,
  goal: string,
  concepts: ConceptSnapshot[]
): { sessionState: SessionState; prompt: ConstructedPrompt } {
  const sessionState: SessionState = {
    sessionId,
    userId,
    goal,
    currentMode: SessionMode.TEACH,
    currentConcept: null,
    exchangeCount: 0,
    totalExchanges: 0,
    conceptsHit: [],
    exchanges: [],
    startedAt: new Date(),
  };

  // Make the first decision
  const decision = makeDecision(concepts, sessionState);

  // Update session state with the decision
  sessionState.currentMode = decision.mode;
  sessionState.currentConcept = decision.concept;

  if (decision.concept.id !== "placeholder") {
    sessionState.conceptsHit.push(decision.concept.id);
  }

  const prompt = constructPrompt(decision, sessionState);

  return { sessionState, prompt };
}

/**
 * Get the next action for the session.
 *
 * Call this after recording the previous exchange. Returns the next
 * orchestrator decision and LLM prompt.
 */
export function getNextAction(
  concepts: ConceptSnapshot[],
  sessionState: SessionState
): {
  decision: OrchestratorDecision;
  prompt: ConstructedPrompt;
  shouldEndSession: boolean;
} {
  // Check session soft cap
  const shouldEnd = sessionState.totalExchanges >= 20;

  // Check if we need to transition mode or concept
  const transition = shouldTransition(sessionState);

  if (transition) {
    // Mode transition on the current concept
    sessionState.currentMode = transition.nextMode;
    sessionState.exchangeCount = 0;

    // If transitioning away from QUIZ after max exchanges, pick a new concept
    if (
      transition.nextMode === SessionMode.TEACH &&
      sessionState.currentMode === SessionMode.QUIZ
    ) {
      const nextConcept = selectNextConcept(concepts, sessionState);
      if (nextConcept) {
        sessionState.currentConcept = nextConcept;
        if (!sessionState.conceptsHit.includes(nextConcept.id)) {
          sessionState.conceptsHit.push(nextConcept.id);
        }
      }
    }
  }

  const decision = makeDecision(concepts, sessionState);

  // Update session state
  sessionState.currentMode = decision.mode;
  sessionState.currentConcept = decision.concept;

  if (
    decision.concept.id !== "placeholder" &&
    !sessionState.conceptsHit.includes(decision.concept.id)
  ) {
    sessionState.conceptsHit.push(decision.concept.id);
  }

  const prompt = constructPrompt(decision, sessionState);

  return { decision, prompt, shouldEndSession: shouldEnd };
}

/**
 * Record a conversation exchange in the session state.
 *
 * Call this after each user message or assistant response.
 */
export function recordExchange(
  sessionState: SessionState,
  role: "user" | "assistant",
  content: string
): SessionState {
  const exchange: SessionExchange = {
    role,
    content,
    mode: sessionState.currentMode,
    timestamp: new Date(),
  };

  return {
    ...sessionState,
    exchanges: [...sessionState.exchanges, exchange],
    exchangeCount: sessionState.exchangeCount + 1,
    totalExchanges: sessionState.totalExchanges + 1,
  };
}

// ============================================================================
// Quiz / Review Processing
// ============================================================================

/**
 * Process a quiz result: update mastery, run SM-2, return updated concept.
 *
 * Call this after the LLM grades the learner's quiz answer.
 */
export function processQuizResult(
  concept: ConceptSnapshot,
  score: number,
  confidence?: "low" | "medium" | "high"
): {
  updatedConcept: Partial<ConceptSnapshot>;
  sm2Result: ReturnType<typeof calculateSM2>;
} {
  // Update mastery
  const newMastery = updateMastery(
    concept.mastery,
    score,
    concept.exposureCount,
    confidence
  );

  // Convert score to SM-2 quality and calculate new interval
  const quality = scoreToQuality(score, confidence);
  const sm2Result = calculateSM2(
    quality,
    concept.reviewInterval,
    concept.easeFactor
  );

  // Determine if difficulty tier should advance
  let newTier = concept.difficultyTier;
  if (newMastery >= 0.7 && score >= 0.8) {
    const tiers: DifficultyTier[] = [
      DifficultyTier.FOUNDATION,
      DifficultyTier.WORKING,
      DifficultyTier.DEEP,
      DifficultyTier.APPLIED,
    ];
    const idx = tiers.indexOf(concept.difficultyTier);
    if (idx < tiers.length - 1) {
      newTier = tiers[idx + 1];
    }
  }

  return {
    updatedConcept: {
      mastery: newMastery,
      difficultyTier: newTier,
      reviewInterval: sm2Result.interval,
      easeFactor: sm2Result.easeFactor,
      lastReviewed: new Date(),
      exposureCount: concept.exposureCount + 1,
    },
    sm2Result,
  };
}

// ============================================================================
// Review Queue (for Dashboard)
// ============================================================================

/**
 * Get concepts due for review, sorted by urgency.
 *
 * Call this to populate the dashboard review queue.
 */
export function getReviewQueue(
  concepts: ConceptSnapshot[],
  limit: number = 10
): Array<ConceptSnapshot & { urgency: number; decayedMastery: number }> {
  return concepts
    .filter((c) => isDueForReview(c))
    .map((c) => ({
      ...c,
      urgency: reviewUrgency(c),
      decayedMastery: decayMastery(c),
    }))
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit);
}

// ============================================================================
// Concept Extraction Helper
// ============================================================================

/**
 * Parse concept names from an LLM response's concepts_introduced array.
 *
 * Normalizes and deduplicates against existing concepts.
 * Used after TEACH mode to upsert new concept nodes.
 */
export function extractNewConcepts(
  llmConcepts: string[],
  existingConcepts: ConceptSnapshot[],
  parentTopic: string
): Array<{ topic: string; parentTopic: string }> {
  const existingTopics = new Set(
    existingConcepts.map((c) => c.topic.toLowerCase().trim())
  );

  return llmConcepts
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !existingTopics.has(c.toLowerCase()))
    .map((topic) => ({ topic, parentTopic }));
}

// ============================================================================
// Grading Prompt (pass-through to prompt constructor)
// ============================================================================

export { constructGradePrompt } from "./prompt-constructor";

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  SessionMode,
  DifficultyTier,
  type ConceptSnapshot,
  type SessionState,
  type OrchestratorDecision,
  type ConstructedPrompt,
  type SessionExchange,
} from "./types";

export { decayMastery, isDueForReview } from "./sm2";
