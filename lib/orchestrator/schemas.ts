// ============================================================================
// Cortex — LLM Response Schemas
// ============================================================================
// Runtime validation for every JSON shape the LLM is asked to produce (see
// prompt-constructor.ts). Responses that fail validation are retried once by
// callLLMJson() and never reach the UI or the database unvalidated.
//
// Schemas are deliberately lenient about optional extras (hints default to [])
// and strict about what the UI and the learner model actually depend on.
// ============================================================================

import { z } from "zod";
import { SessionMode } from "./types";

const requiredText = z.string().trim().min(1);
const textList = z.array(z.string()).default([]);

export const TeachResponseSchema = z.object({
  explanation: requiredText,
  check_question: requiredText,
  hints: textList,
  concepts_introduced: textList,
});

export const QuizResponseSchema = z.object({
  question: requiredText,
  rubric: requiredText,
  hints: textList,
});

export const SocraticResponseSchema = z.object({
  question: requiredText,
  hints: textList,
  guidance_direction: z.string().default(""),
  concepts_probed: textList,
});

export const ReviewResponseSchema = z.object({
  context_reminder: z.string().default(""),
  question: requiredText,
  rubric: requiredText,
  hints: textList,
});

/** Grade for a QUIZ/REVIEW answer. Scores outside 0–1 are rejected (and retried), not clamped. */
export const QuizGradeResponseSchema = z.object({
  score: z.coerce.number().min(0).max(1),
  reasoning: requiredText,
  correct_answer: z.string().default(""),
});

export const SocraticEvalResponseSchema = z.object({
  understanding_achieved: z.boolean(),
  follow_up_question: z.string().nullable().default(null),
  hints: textList,
  guidance_direction: z.string().default(""),
});

/** The schema for the block a given mode opens with. */
export const BLOCK_SCHEMAS = {
  [SessionMode.TEACH]: TeachResponseSchema,
  [SessionMode.QUIZ]: QuizResponseSchema,
  [SessionMode.SOCRATIC]: SocraticResponseSchema,
  [SessionMode.REVIEW]: ReviewResponseSchema,
} as const;

export type BlockResponse = z.output<(typeof BLOCK_SCHEMAS)[SessionMode]>;
export type QuizGrade = z.output<typeof QuizGradeResponseSchema>;
export type SocraticEval = z.output<typeof SocraticEvalResponseSchema>;
