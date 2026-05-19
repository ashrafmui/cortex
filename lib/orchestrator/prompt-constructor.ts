// ============================================================================
// Cortex Session Orchestrator — Prompt Constructor
// ============================================================================
// Builds structured system prompts for the LLM based on the orchestrator's
// mode decision. The LLM is a data source — it generates content within
// the constraints this module sets.
//
// All prompts request JSON output. The UI renders structured data, never raw
// markdown from the LLM.
// ============================================================================

import {
  SessionMode,
  DifficultyTier,
  type ConceptSnapshot,
  type ConstructedPrompt,
  type OrchestratorDecision,
  type SessionState,
  type SessionExchange,
} from "./types";

// ============================================================================
// Tier Descriptions (for LLM context)
// ============================================================================

const TIER_DESCRIPTIONS: Record<DifficultyTier, string> = {
  [DifficultyTier.FOUNDATION]:
    "Beginner level. Use simple language, concrete analogies, and real-world examples. Assume no prior knowledge of this specific concept.",
  [DifficultyTier.WORKING]:
    "Intermediate level. The learner understands basics. Use precise terminology, show how this connects to related concepts, include short code snippets or formulas where relevant.",
  [DifficultyTier.DEEP]:
    "Advanced level. The learner has working knowledge. Explore edge cases, tradeoffs, implementation details, and common pitfalls. Challenge assumptions.",
  [DifficultyTier.APPLIED]:
    "Expert application level. Pose real-world scenarios, system design problems, or debugging challenges that require combining this concept with others.",
};

// ============================================================================
// Shared Prompt Fragments
// ============================================================================

const JSON_INSTRUCTION = `
CRITICAL: Respond ONLY with valid JSON. No markdown, no code fences, no preamble, no commentary outside the JSON object. Your entire response must be parseable by JSON.parse().`;

function knownConceptsClause(
  sessionState: SessionState,
  currentConcept: ConceptSnapshot
): string {
  const knownTopics = sessionState.conceptsHit
    .filter((id) => id !== currentConcept.id)
    .slice(-5); // last 5 concepts for context

  if (knownTopics.length === 0) return "";

  return `\nThe learner has already covered these concepts in this session (do not re-explain them unless building on them): [${knownTopics.join(", ")}]`;
}

function recentExchangeContext(sessionState: SessionState): string {
  const recent = sessionState.exchanges.slice(-4); // last 2 turns
  if (recent.length === 0) return "";

  const formatted = recent
    .map((e) => `${e.role}: ${e.content.slice(0, 200)}`)
    .join("\n");

  return `\nRecent conversation context:\n${formatted}`;
}

// ============================================================================
// Mode-Specific Prompt Builders
// ============================================================================

function buildTeachPrompt(
  concept: ConceptSnapshot,
  tier: DifficultyTier,
  sessionState: SessionState
): string {
  return `You are an expert tutor. Your task is to explain a concept clearly and effectively.

TOPIC: ${concept.topic}${concept.parentTopic ? `\nPARENT TOPIC: ${concept.parentTopic}` : ""}
DIFFICULTY LEVEL: ${tier}
LEVEL DESCRIPTION: ${TIER_DESCRIPTIONS[tier]}
LEARNER'S PRIOR EXPOSURE: ${concept.exposureCount} times (mastery: ${concept.mastery.toFixed(2)})
${knownConceptsClause(sessionState, concept)}
${recentExchangeContext(sessionState)}

INSTRUCTIONS:
1. Explain "${concept.topic}" at the ${tier} level.
2. Use concrete examples, analogies, or code snippets appropriate to the level.
3. Keep the explanation focused — cover ONE key idea thoroughly rather than skimming many.
4. End with exactly ONE comprehension check question that tests whether the learner understood the core idea.
5. List 1-3 sub-concepts or related concepts that were introduced in your explanation.
${JSON_INSTRUCTION}

Respond with this exact JSON structure:
{
  "explanation": "Your explanation here (use \\n for line breaks)",
  "check_question": "A single question to verify understanding",
  "concepts_introduced": ["concept1", "concept2"]
}`;
}

function buildQuizPrompt(
  concept: ConceptSnapshot,
  tier: DifficultyTier,
  sessionState: SessionState
): string {
  return `You are an expert tutor generating a quiz question to test a learner's knowledge.

TOPIC: ${concept.topic}${concept.parentTopic ? `\nPARENT TOPIC: ${concept.parentTopic}` : ""}
DIFFICULTY LEVEL: ${tier}
LEVEL DESCRIPTION: ${TIER_DESCRIPTIONS[tier]}
LEARNER'S PRIOR EXPOSURE: ${concept.exposureCount} times
CURRENT MASTERY: ${concept.mastery.toFixed(2)}
${knownConceptsClause(sessionState, concept)}
${recentExchangeContext(sessionState)}

INSTRUCTIONS:
1. Generate a single question testing "${concept.topic}" at the ${tier} level.
2. The question should require the learner to RECALL or APPLY knowledge, not just recognize it.
3. For ${tier === DifficultyTier.FOUNDATION ? "foundation" : "higher"} level: ${
    tier === DifficultyTier.FOUNDATION
      ? "ask definitional or conceptual questions"
      : tier === DifficultyTier.WORKING
        ? "ask questions that require connecting concepts or short problem-solving"
        : tier === DifficultyTier.DEEP
          ? "ask about edge cases, tradeoffs, or implementation details"
          : "pose a realistic scenario or debugging problem"
  }.
4. Provide a grading rubric (what constitutes a perfect answer vs. partial credit).
5. Provide 1-2 progressive hints (each hint reveals a bit more without giving the answer away).
${JSON_INSTRUCTION}

Respond with this exact JSON structure:
{
  "question": "Your question here",
  "rubric": "What a 1.0 answer looks like vs. 0.5 vs. 0.0",
  "hints": ["First hint (subtle nudge)", "Second hint (more direct)"]
}`;
}

function buildQuizGradePrompt(
  concept: ConceptSnapshot,
  question: string,
  learnerAnswer: string,
  rubric: string
): string {
  return `You are grading a learner's answer to a quiz question.

TOPIC: ${concept.topic}
QUESTION: ${question}
RUBRIC: ${rubric}
LEARNER'S ANSWER: ${learnerAnswer}

INSTRUCTIONS:
1. Score the answer from 0.0 to 1.0 based on the rubric.
2. Be fair but rigorous. Partial credit for partial understanding.
3. Explain what was correct and what was missing or wrong.
4. Provide the correct/ideal answer for the learner to compare against.
${JSON_INSTRUCTION}

Respond with this exact JSON structure:
{
  "score": 0.0,
  "reasoning": "What was right, what was wrong, what was missing",
  "correct_answer": "The ideal answer"
}`;
}

function buildSocraticPrompt(
  concept: ConceptSnapshot,
  tier: DifficultyTier,
  sessionState: SessionState
): string {
  return `You are a Socratic tutor. You do NOT explain directly — you ask questions that guide the learner toward understanding.

TOPIC: ${concept.topic}${concept.parentTopic ? `\nPARENT TOPIC: ${concept.parentTopic}` : ""}
DIFFICULTY LEVEL: ${tier}
LEVEL DESCRIPTION: ${TIER_DESCRIPTIONS[tier]}
LEARNER'S MASTERY: ${concept.mastery.toFixed(2)} (they've seen this ${concept.exposureCount} times but are struggling)
${knownConceptsClause(sessionState, concept)}
${recentExchangeContext(sessionState)}

INSTRUCTIONS:
1. Ask ONE focused question that leads the learner toward understanding "${concept.topic}".
2. The question should build on what they might already know and connect to something concrete.
3. Do NOT explain the concept. Do NOT give the answer. Guide with questions only.
4. Include a brief internal note about what direction you're guiding them toward (this helps the orchestrator track progress).
5. List the specific sub-concepts your question probes.
${JSON_INSTRUCTION}

Respond with this exact JSON structure:
{
  "question": "Your Socratic question here",
  "guidance_direction": "What understanding this question leads toward",
  "concepts_probed": ["concept1", "concept2"]
}`;
}

function buildReviewPrompt(
  concept: ConceptSnapshot,
  tier: DifficultyTier,
  sessionState: SessionState
): string {
  return `You are a tutor conducting a spaced repetition review.

TOPIC: ${concept.topic}${concept.parentTopic ? `\nPARENT TOPIC: ${concept.parentTopic}` : ""}
DIFFICULTY LEVEL: ${tier}
LAST REVIEWED: ${concept.lastReviewed?.toISOString() ?? "never"}
REVIEW INTERVAL: ${concept.reviewInterval} days (this concept is due or overdue)
CURRENT MASTERY: ${concept.mastery.toFixed(2)}
${recentExchangeContext(sessionState)}

INSTRUCTIONS:
1. Provide a brief context reminder (1-2 sentences) to jog the learner's memory about "${concept.topic}" without fully re-explaining it.
2. Then ask a recall question that tests whether they still understand the concept.
3. Include a grading rubric.
4. The question should be at the ${tier} level — review doesn't mean easy.
${JSON_INSTRUCTION}

Respond with this exact JSON structure:
{
  "context_reminder": "Brief reminder about this concept",
  "question": "Your recall question here",
  "rubric": "What a 1.0 answer looks like vs. 0.5 vs. 0.0"
}`;
}

// ============================================================================
// Main Prompt Construction
// ============================================================================

/**
 * Build the complete LLM prompt from an orchestrator decision.
 *
 * This is the function API routes call after makeDecision().
 */
export function constructPrompt(
  decision: OrchestratorDecision,
  sessionState: SessionState
): ConstructedPrompt {
  let systemPrompt: string;

  switch (decision.mode) {
    case SessionMode.TEACH:
      systemPrompt = buildTeachPrompt(
        decision.concept,
        decision.difficultyTier,
        sessionState
      );
      break;

    case SessionMode.QUIZ:
      systemPrompt = buildQuizPrompt(
        decision.concept,
        decision.difficultyTier,
        sessionState
      );
      break;

    case SessionMode.SOCRATIC:
      systemPrompt = buildSocraticPrompt(
        decision.concept,
        decision.difficultyTier,
        sessionState
      );
      break;

    case SessionMode.REVIEW:
      systemPrompt = buildReviewPrompt(
        decision.concept,
        decision.difficultyTier,
        sessionState
      );
      break;
  }

  return {
    systemPrompt,
    mode: decision.mode,
    concept: decision.concept,
    difficultyTier: decision.difficultyTier,
  };
}

/**
 * Build a grading prompt for evaluating a quiz/review answer.
 * Called separately after the user responds to a QUIZ or REVIEW question.
 */
export function constructGradePrompt(
  concept: ConceptSnapshot,
  question: string,
  learnerAnswer: string,
  rubric: string
): string {
  return buildQuizGradePrompt(concept, question, learnerAnswer, rubric);
}
