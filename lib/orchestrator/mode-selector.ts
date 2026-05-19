// ============================================================================
// Cortex Session Orchestrator — Mode Selector
// ============================================================================
// Deterministic logic that decides:
//   1. What concept to teach/review next
//   2. What mode to use (TEACH / QUIZ / SOCRATIC / REVIEW)
//   3. What difficulty tier to set
//
// This is the "brain" — no LLM calls, pure logic over the knowledge graph.
// ============================================================================

import {
  SessionMode,
  DifficultyTier,
  type ConceptSnapshot,
  type OrchestratorDecision,
  type SessionState,
} from "./types";
import { isDueForReview, reviewUrgency, decayMastery } from "./sm2";

// ============================================================================
// Constants (tunable parameters)
// ============================================================================

/** Mastery thresholds for mode selection. */
const MASTERY_THRESHOLDS = {
  /** Below this → SOCRATIC (struggling, needs guided discovery) */
  SOCRATIC_CEILING: 0.4,
  /** Between SOCRATIC_CEILING and this → QUIZ (testing retention) */
  QUIZ_CEILING: 0.7,
  /** Above QUIZ_CEILING → concept is "known", move on or advance difficulty */
};

/** Exchange limits before forcing a mode transition. */
const TRANSITION_LIMITS = {
  /** Max exchanges in TEACH before shifting to QUIZ */
  TEACH_MAX_EXCHANGES: 3,
  /** Max exchanges in SOCRATIC before giving a direct explanation */
  SOCRATIC_MAX_EXCHANGES: 4,
  /** Max exchanges in QUIZ on one concept before moving on */
  QUIZ_MAX_EXCHANGES: 3,
};

/** Session-level soft cap. */
const SESSION_SOFT_CAP_EXCHANGES = 20;

// ============================================================================
// Difficulty Tier Progression
// ============================================================================

const TIER_ORDER: DifficultyTier[] = [
  DifficultyTier.FOUNDATION,
  DifficultyTier.WORKING,
  DifficultyTier.DEEP,
  DifficultyTier.APPLIED,
];

/**
 * Advance to the next difficulty tier if available.
 */
function advanceTier(current: DifficultyTier): DifficultyTier {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : current;
}

// ============================================================================
// Concept Selection
// ============================================================================

/**
 * Select the next concept to work on given the user's knowledge graph
 * and the current session goal.
 *
 * Priority order (from PRD Section 4.3):
 *   1. Low-mastery prerequisites (unblock the learning path)
 *   2. New concepts (no exposure yet, related to the goal)
 *   3. Review-due concepts (spaced repetition maintenance)
 */
export function selectNextConcept(
  concepts: ConceptSnapshot[],
  sessionState: SessionState
): ConceptSnapshot | null {
  if (concepts.length === 0) return null;

  // Apply mastery decay to get "effective" mastery for all concepts
  const withDecay = concepts.map((c) => ({
    ...c,
    mastery: decayMastery(c),
  }));

  // Exclude concepts already hit this session (avoid repetition)
  const available = withDecay.filter(
    (c) => !sessionState.conceptsHit.includes(c.id)
  );

  // If all concepts have been touched, allow revisits
  const pool = available.length > 0 ? available : withDecay;

  // 1. Low-mastery prerequisites first (mastery < 0.4, has been seen before)
  const struggling = pool
    .filter((c) => c.exposureCount > 0 && c.mastery < MASTERY_THRESHOLDS.SOCRATIC_CEILING)
    .sort((a, b) => a.mastery - b.mastery);

  if (struggling.length > 0) return struggling[0];

  // 2. New concepts (never seen, related to the goal)
  const unseen = pool
    .filter((c) => c.exposureCount === 0)
    .sort((a, b) => {
      // Prefer concepts whose parent topic matches the session goal
      const aMatch = c_matchesGoal(a, sessionState.goal) ? -1 : 0;
      const bMatch = c_matchesGoal(b, sessionState.goal) ? -1 : 0;
      return aMatch - bMatch;
    });

  if (unseen.length > 0) return unseen[0];

  // 3. Review-due concepts, ranked by urgency
  const reviewDue = pool
    .filter((c) => isDueForReview(c))
    .sort((a, b) => reviewUrgency(b) - reviewUrgency(a));

  if (reviewDue.length > 0) return reviewDue[0];

  // 4. Fallback: lowest mastery concept in the pool
  return pool.sort((a, b) => a.mastery - b.mastery)[0] ?? null;
}

/**
 * Simple goal matching — checks if the concept's topic or parent topic
 * contains the session goal keywords. In production, this could use
 * embedding similarity or LLM-assisted matching.
 */
function c_matchesGoal(concept: ConceptSnapshot, goal: string): boolean {
  const goalLower = goal.toLowerCase();
  const topicLower = concept.topic.toLowerCase();
  const parentLower = concept.parentTopic?.toLowerCase() ?? "";

  return (
    goalLower.includes(topicLower) ||
    topicLower.includes(goalLower) ||
    parentLower.includes(goalLower) ||
    goalLower.includes(parentLower)
  );
}

// ============================================================================
// Mode Selection
// ============================================================================

/**
 * Select the learning mode for a given concept based on its mastery
 * and review status.
 *
 * Decision tree (from PRD Section 4.3):
 *   - New concept (exposure 0)          → TEACH
 *   - Seen before, mastery < 0.4        → SOCRATIC
 *   - Mastery 0.4 – 0.7                 → QUIZ
 *   - Due for review                    → REVIEW
 *   - Mastery > 0.7, not due            → QUIZ at higher difficulty
 */
export function selectMode(
  concept: ConceptSnapshot,
  sessionState: SessionState
): SessionMode {
  const effectiveMastery = decayMastery(concept);

  // Never seen → teach it
  if (concept.exposureCount === 0) {
    return SessionMode.TEACH;
  }

  // Due for review → review mode
  if (isDueForReview(concept)) {
    return SessionMode.REVIEW;
  }

  // Struggling → Socratic guided discovery
  if (effectiveMastery < MASTERY_THRESHOLDS.SOCRATIC_CEILING) {
    return SessionMode.SOCRATIC;
  }

  // Moderate mastery → quiz to test retention
  if (effectiveMastery < MASTERY_THRESHOLDS.QUIZ_CEILING) {
    return SessionMode.QUIZ;
  }

  // High mastery → quiz at current or advanced tier
  return SessionMode.QUIZ;
}

// ============================================================================
// Transition Logic
// ============================================================================

/**
 * Determine if the current mode should transition to a different mode
 * or concept based on exchange count.
 *
 * Returns null if no transition is needed (stay the course).
 */
export function shouldTransition(
  sessionState: SessionState
): { nextMode: SessionMode; reason: string } | null {
  const { currentMode, exchangeCount } = sessionState;

  switch (currentMode) {
    case SessionMode.TEACH:
      if (exchangeCount >= TRANSITION_LIMITS.TEACH_MAX_EXCHANGES) {
        return {
          nextMode: SessionMode.QUIZ,
          reason: `TEACH mode hit ${TRANSITION_LIMITS.TEACH_MAX_EXCHANGES} exchanges — transitioning to QUIZ to test comprehension`,
        };
      }
      break;

    case SessionMode.SOCRATIC:
      if (exchangeCount >= TRANSITION_LIMITS.SOCRATIC_MAX_EXCHANGES) {
        return {
          nextMode: SessionMode.TEACH,
          reason: `SOCRATIC mode hit ${TRANSITION_LIMITS.SOCRATIC_MAX_EXCHANGES} exchanges — learner may be stuck, switching to direct TEACH`,
        };
      }
      break;

    case SessionMode.QUIZ:
      if (exchangeCount >= TRANSITION_LIMITS.QUIZ_MAX_EXCHANGES) {
        return {
          nextMode: SessionMode.TEACH,
          reason: `QUIZ mode hit ${TRANSITION_LIMITS.QUIZ_MAX_EXCHANGES} exchanges on this concept — moving on`,
        };
      }
      break;

    case SessionMode.REVIEW:
      // Review is typically a single exchange (question → answer → grade)
      if (exchangeCount >= 2) {
        return {
          nextMode: SessionMode.QUIZ,
          reason: "REVIEW complete — transitioning to QUIZ for reinforcement",
        };
      }
      break;
  }

  return null;
}

// ============================================================================
// Main Decision Function
// ============================================================================

/**
 * The core orchestrator decision: given the learner's knowledge graph
 * and current session state, decide what to do next.
 *
 * This is the function that API routes call on each turn.
 */
export function makeDecision(
  concepts: ConceptSnapshot[],
  sessionState: SessionState
): OrchestratorDecision {
  // Check if we should transition modes on the current concept
  const transition = shouldTransition(sessionState);

  if (transition && sessionState.currentConcept) {
    return {
      mode: transition.nextMode,
      concept: sessionState.currentConcept,
      difficultyTier: sessionState.currentConcept.difficultyTier,
      reason: transition.reason,
    };
  }

  // Select the next concept (may be the same one if we're mid-exchange)
  const nextConcept = sessionState.currentConcept
    ? sessionState.currentConcept
    : selectNextConcept(concepts, sessionState);

  if (!nextConcept) {
    // Edge case: no concepts available (new user, first session)
    // Return TEACH on a placeholder — the prompt constructor will
    // ask the LLM to introduce the goal topic broadly
    return {
      mode: SessionMode.TEACH,
      concept: createPlaceholderConcept(sessionState.goal),
      difficultyTier: DifficultyTier.FOUNDATION,
      reason: "No concepts in knowledge graph — starting fresh on session goal",
    };
  }

  const mode = selectMode(nextConcept, sessionState);
  const effectiveMastery = decayMastery(nextConcept);

  // If mastery is high and mode is QUIZ, consider advancing difficulty
  let tier = nextConcept.difficultyTier;
  if (
    mode === SessionMode.QUIZ &&
    effectiveMastery >= MASTERY_THRESHOLDS.QUIZ_CEILING
  ) {
    tier = advanceTier(tier);
  }

  return {
    mode,
    concept: nextConcept,
    difficultyTier: tier,
    reason: buildReasonString(mode, nextConcept, effectiveMastery),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createPlaceholderConcept(goal: string): ConceptSnapshot {
  return {
    id: "placeholder",
    topic: goal,
    parentTopic: null,
    mastery: 0.0,
    difficultyTier: DifficultyTier.FOUNDATION,
    lastReviewed: null,
    reviewInterval: 1,
    easeFactor: 2.5,
    exposureCount: 0,
  };
}

function buildReasonString(
  mode: SessionMode,
  concept: ConceptSnapshot,
  effectiveMastery: number
): string {
  const m = effectiveMastery.toFixed(2);
  switch (mode) {
    case SessionMode.TEACH:
      return `"${concept.topic}" is new (exposure: ${concept.exposureCount}) — teaching at ${concept.difficultyTier}`;
    case SessionMode.SOCRATIC:
      return `"${concept.topic}" mastery is low (${m}) — using Socratic questioning`;
    case SessionMode.QUIZ:
      return `"${concept.topic}" mastery at ${m} — testing with quiz`;
    case SessionMode.REVIEW:
      return `"${concept.topic}" is due for review — mastery ${m}, last reviewed ${concept.lastReviewed?.toISOString() ?? "never"}`;
  }
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testExports = {
  MASTERY_THRESHOLDS,
  TRANSITION_LIMITS,
  advanceTier,
  c_matchesGoal,
};
