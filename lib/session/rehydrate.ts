// ============================================================================
// Session Rehydration
// ============================================================================
// Rebuilds the UI block feed and a resumable SessionState from a persisted
// Session row (its `messages` exchange log). This is what lets a mid-session
// refresh or a fresh tab resume where the learner left off.
//
// Pure and framework-free so it can run server-side (in the GET route) and be
// unit-tested. The client renders whatever this returns.
//
// Fidelity notes — some purely-visual state is not stored and is intentionally
// lost on rehydrate: per-answer mastery deltas, how many hints were revealed,
// and (for pre-existing sessions) per-block difficulty/concept labels.
// ============================================================================

import {
  SessionMode,
  type ConceptSnapshot,
  type SessionState,
  type SessionExchange,
  type SocraticTurn,
} from "@/lib/orchestrator/types";

/** A rendered unit of the session feed (one AI prompt + the learner's interaction). */
export interface SessionBlock {
  id: string;
  mode: string;
  concept: string;
  difficulty: string;
  response: Record<string, unknown>;
  hints: string[];
  quizMeta?: { question: string; rubric: string };
  socraticTurns?: SocraticTurn[];
  userAnswer?: string;
  grade?: { score: number; reasoning: string; correct_answer: string };
  masteryBefore?: number;
  masteryAfter?: number;
  status: "active" | "done";
}

/** Shape of one stored exchange (messages JSON element). */
interface ExchangeMsg {
  role: "user" | "assistant";
  content: string;
  mode: string;
  concept?: string;
  timestamp?: string;
}

/** Minimal shape of a persisted Session row needed to rehydrate. */
export interface StoredSession {
  id: string;
  userId: string;
  goal: string;
  mode: string;
  messages: unknown;
  conceptsHit: string[];
  startedAt: Date | string;
  endedAt?: Date | string | null;
}

/** The soft cap that ends a session (mirrors getNextAction). */
const SESSION_SOFT_CAP = 20;

function parseObj(content: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(content);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}

/**
 * Rebuild the ordered block feed from an exchange log.
 * Classifies each assistant message by its JSON shape:
 *   - has score + correct_answer         → a grade (attaches to current block)
 *   - has understanding_achieved         → a Socratic eval (folds into the block)
 *   - otherwise                          → a new block (TEACH/QUIZ/SOCRATIC/REVIEW)
 */
export function rebuildBlocks(exchanges: ExchangeMsg[]): SessionBlock[] {
  const blocks: SessionBlock[] = [];
  let cur: SessionBlock | null = null;
  let socraticQ: string | null = null; // current unanswered Socratic question
  let pendingAnswer: string | null = null; // last learner reply awaiting a Socratic eval

  const closeActiveNonSocratic = () => {
    if (cur && cur.status === "active" && cur.mode !== "SOCRATIC") cur.status = "done";
  };

  for (const msg of exchanges) {
    if (msg.role === "user") {
      if (cur && cur.mode === "SOCRATIC") pendingAnswer = msg.content;
      else if (cur) cur.userAnswer = msg.content;
      continue;
    }

    const obj = parseObj(msg.content);
    if (!obj) continue;

    // Grade → attach to the current graded block.
    if ("score" in obj && "correct_answer" in obj) {
      if (cur) {
        cur.grade = {
          score: Number(obj.score ?? 0),
          reasoning: String(obj.reasoning ?? ""),
          correct_answer: String(obj.correct_answer ?? ""),
        };
        cur.status = "done";
      }
      continue;
    }

    // Socratic eval → bank the answered turn, then loop or conclude.
    if ("understanding_achieved" in obj) {
      if (cur && cur.mode === "SOCRATIC") {
        if (pendingAnswer != null && socraticQ != null) {
          (cur.socraticTurns ??= []).push({ question: socraticQ, userAnswer: pendingAnswer });
          pendingAnswer = null;
        }
        const followUp =
          typeof obj.follow_up_question === "string" ? obj.follow_up_question : null;
        if (obj.understanding_achieved === true || !followUp) {
          cur.status = "done";
          socraticQ = null;
        } else {
          socraticQ = followUp;
          cur.response = {
            question: followUp,
            hints: asStringArray(obj.hints),
            guidance_direction: String(obj.guidance_direction ?? ""),
            concepts_probed: [],
          };
          cur.hints = asStringArray(obj.hints);
          cur.status = "active";
        }
      }
      continue;
    }

    // New block opening.
    closeActiveNonSocratic();
    cur = {
      id: `b${blocks.length}`,
      mode: msg.mode,
      concept: msg.concept ?? "—",
      difficulty: "",
      response: obj,
      hints: asStringArray(obj.hints),
      status: "active",
    };
    if (msg.mode === "QUIZ" || msg.mode === "REVIEW") {
      cur.quizMeta = { question: String(obj.question ?? ""), rubric: String(obj.rubric ?? "") };
    }
    if (msg.mode === "SOCRATIC") {
      cur.socraticTurns = [];
      socraticQ = typeof obj.question === "string" ? obj.question : "";
    }
    blocks.push(cur);
  }

  return blocks;
}

/**
 * Rebuild everything needed to resume a session: the goal, a resumable
 * SessionState (for the next API call), the rendered blocks, and whether the
 * session is already over.
 */
export function rehydrateSession(
  session: StoredSession,
  concepts: ConceptSnapshot[]
): { goal: string; sessionState: SessionState; blocks: SessionBlock[]; sessionEnded: boolean } {
  const exchanges: ExchangeMsg[] = Array.isArray(session.messages)
    ? (session.messages as ExchangeMsg[])
    : [];

  const blocks = rebuildBlocks(exchanges);
  const currentMode = session.mode as SessionMode;
  const totalExchanges = exchanges.length;

  // Current concept: prefer the topic on the most recent assistant exchange,
  // falling back to the last id in conceptsHit.
  let currentConcept: ConceptSnapshot | null = null;
  for (let i = exchanges.length - 1; i >= 0; i--) {
    const e = exchanges[i];
    if (e.role === "assistant" && e.concept) {
      currentConcept = concepts.find((c) => c.topic === e.concept) ?? null;
      break;
    }
  }
  if (!currentConcept && session.conceptsHit.length > 0) {
    const lastId = session.conceptsHit[session.conceptsHit.length - 1];
    currentConcept = concepts.find((c) => c.id === lastId) ?? null;
  }

  // exchangeCount: trailing run of exchanges still in the current mode.
  let exchangeCount = 0;
  for (let i = exchanges.length - 1; i >= 0; i--) {
    if (exchanges[i].mode === currentMode) exchangeCount++;
    else break;
  }

  // Socratic turns only carry over if we're paused mid-dialogue on the last block.
  const last = blocks[blocks.length - 1];
  const socraticTurns: SocraticTurn[] =
    currentMode === SessionMode.SOCRATIC &&
    last?.mode === "SOCRATIC" &&
    last.status === "active"
      ? last.socraticTurns ?? []
      : [];

  const sessionEnded = !!session.endedAt || totalExchanges >= SESSION_SOFT_CAP;

  const sessionState: SessionState = {
    sessionId: session.id,
    userId: session.userId,
    goal: session.goal,
    currentMode,
    currentConcept,
    exchangeCount,
    totalExchanges,
    conceptsHit: session.conceptsHit,
    exchanges: exchanges as unknown as SessionExchange[],
    socraticTurns,
    startedAt: new Date(session.startedAt),
  };

  return { goal: session.goal, sessionState, blocks, sessionEnded };
}
