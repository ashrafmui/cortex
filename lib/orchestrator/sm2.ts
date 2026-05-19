// ============================================================================
// Cortex SM-2 Spaced Repetition Engine
// ============================================================================
// Implementation of the SuperMemo 2 algorithm with mastery decay.
// Reference: https://super-memory.com/english/ol/sm2.htm
//
// SM-2 core rules:
//   - Quality 0-2: reset interval to 1 (failed recall)
//   - Quality 3+: advance interval using ease factor
//   - Ease factor adjusts based on response quality (min 1.3)
// ============================================================================

import type { SM2Quality, SM2Result, ConceptSnapshot } from "./types";

// ============================================================================
// Constants
// ============================================================================

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const MASTERY_DECAY_RATE = 0.05; // mastery points lost per overdue interval

// ============================================================================
// Core SM-2 Calculation
// ============================================================================

/**
 * Calculate the next review interval and updated ease factor.
 *
 * @param quality      - Response quality rating (0-5)
 * @param prevInterval - Previous interval in days
 * @param prevEase     - Previous ease factor
 * @returns SM2Result with new interval, ease factor, and next review date
 */
export function calculateSM2(
  quality: SM2Quality,
  prevInterval: number,
  prevEase: number
): SM2Result {
  let interval: number;
  let easeFactor: number;

  // Update ease factor using SM-2 formula
  easeFactor =
    prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor);

  if (quality < 3) {
    // Failed recall — reset to day 1
    interval = 1;
  } else {
    // Successful recall — advance interval
    if (prevInterval === 0 || prevInterval === 1) {
      interval = 1;
    } else if (prevInterval === 2) {
      interval = 6;
    } else {
      interval = Math.round(prevInterval * easeFactor);
    }
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { interval, easeFactor, nextReviewDate };
}

// ============================================================================
// Quiz Score → SM-2 Quality Mapping
// ============================================================================

/**
 * Map a quiz score (0.0–1.0) and optional confidence to an SM-2 quality rating.
 *
 * The confidence modifier penalizes high-confidence wrong answers more
 * and rewards low-confidence correct answers less — matching the PRD's
 * requirement that "if the user was confident and wrong, mastery drops more."
 *
 * Quality scale:
 *   5 — perfect response, no hesitation
 *   4 — correct after brief hesitation
 *   3 — correct but with significant difficulty
 *   2 — incorrect, but close / partially correct
 *   1 — incorrect, vaguely remembered
 *   0 — complete blackout
 */
export function scoreToQuality(
  score: number,
  confidence?: "low" | "medium" | "high"
): SM2Quality {
  // Base quality from score
  let quality: number;

  if (score >= 0.9) quality = 5;
  else if (score >= 0.7) quality = 4;
  else if (score >= 0.5) quality = 3;
  else if (score >= 0.3) quality = 2;
  else if (score >= 0.1) quality = 1;
  else quality = 0;

  // Confidence modifier: penalize confident-and-wrong, no reward for confident-and-right
  if (confidence === "high" && score < 0.5) {
    quality = Math.max(0, quality - 1);
  } else if (confidence === "low" && score >= 0.7) {
    // Low confidence but correct — treat as slightly less certain
    quality = Math.max(3, quality - 1);
  }

  return Math.round(Math.min(5, Math.max(0, quality))) as SM2Quality;
}

// ============================================================================
// Mastery Update
// ============================================================================

/**
 * Calculate updated mastery after a quiz.
 *
 * Mastery moves toward the score using an exponential moving average,
 * weighted by exposure count (more exposure = slower change).
 */
export function updateMastery(
  currentMastery: number,
  quizScore: number,
  exposureCount: number,
  confidence?: "low" | "medium" | "high"
): number {
  // Learning rate decreases with exposure (diminishing returns)
  const baseLearningRate = 0.3;
  const learningRate = baseLearningRate / (1 + exposureCount * 0.1);

  let delta = (quizScore - currentMastery) * learningRate;

  // Amplify mastery drop for high-confidence incorrect answers
  if (confidence === "high" && quizScore < 0.5) {
    delta *= 1.5;
  }

  const newMastery = currentMastery + delta;
  return Math.min(1.0, Math.max(0.0, newMastery));
}

// ============================================================================
// Mastery Decay (time-based forgetting)
// ============================================================================

/**
 * Apply time-based mastery decay to a concept.
 *
 * Mastery decays when a concept is overdue for review, proportional to
 * how many intervals have passed since the due date.
 */
export function decayMastery(concept: ConceptSnapshot): number {
  if (!concept.lastReviewed || concept.reviewInterval <= 0) {
    return concept.mastery;
  }

  const now = new Date();
  const lastReviewed = new Date(concept.lastReviewed);
  const daysSinceReview =
    (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
  const overdueDays = daysSinceReview - concept.reviewInterval;

  if (overdueDays <= 0) {
    // Not overdue yet — no decay
    return concept.mastery;
  }

  // Decay proportional to how many intervals overdue
  const overdueIntervals = overdueDays / concept.reviewInterval;
  const decay = MASTERY_DECAY_RATE * overdueIntervals;

  return Math.max(0.0, concept.mastery - decay);
}

// ============================================================================
// Review Due Check
// ============================================================================

/**
 * Determine if a concept is due for review.
 */
export function isDueForReview(concept: ConceptSnapshot): boolean {
  if (!concept.lastReviewed) {
    // Never reviewed — only due if it's been seen at least once
    return concept.exposureCount > 0;
  }

  const now = new Date();
  const lastReviewed = new Date(concept.lastReviewed);
  const daysSinceReview =
    (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceReview >= concept.reviewInterval;
}

/**
 * Calculate review urgency — higher = more overdue.
 * Used to rank the review queue.
 */
export function reviewUrgency(concept: ConceptSnapshot): number {
  if (!concept.lastReviewed) {
    return concept.exposureCount > 0 ? 1.0 : 0.0;
  }

  const now = new Date();
  const lastReviewed = new Date(concept.lastReviewed);
  const daysSinceReview =
    (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
  const overdueRatio = daysSinceReview / concept.reviewInterval;

  // Urgency increases exponentially when overdue
  return Math.max(0, overdueRatio - 1.0) + (1.0 - concept.mastery);
}
