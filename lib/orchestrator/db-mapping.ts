import { DifficultyTier, type ConceptSnapshot } from "./types";

type ConceptRow = {
  id: string;
  topic: string;
  parentTopic: string | null;
  mastery: number;
  difficultyTier: string;
  lastReviewed: Date | null;
  reviewInterval: number;
  easeFactor: number;
  exposureCount: number;
};

export function dbToSnapshot(row: ConceptRow): ConceptSnapshot {
  return {
    id: row.id,
    topic: row.topic,
    parentTopic: row.parentTopic,
    mastery: row.mastery,
    difficultyTier: row.difficultyTier as DifficultyTier,
    lastReviewed: row.lastReviewed,
    reviewInterval: row.reviewInterval,
    easeFactor: row.easeFactor,
    exposureCount: row.exposureCount,
  };
}
