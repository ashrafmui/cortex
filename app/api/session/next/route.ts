import { prisma } from "@/lib/prisma";
import {
  getNextAction,
  recordExchange,
  constructSocraticEvalPrompt,
  SOCRATIC_MAX_TURNS,
  SessionMode,
  type ConceptSnapshot,
  type SessionState,
} from "@/lib/orchestrator";
import { BLOCK_SCHEMAS, SocraticEvalResponseSchema } from "@/lib/orchestrator/schemas";
import { callLLMJson } from "@/lib/llm";
import {
  errorResponse,
  loadConcepts,
  loadOpenSession,
  readJsonBody,
  requireText,
  requireUserId,
} from "@/lib/session/http";
import { findPendingBlock, reconcileSessionState } from "@/lib/session/server-state";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJsonBody(request);
    const claimed = body.sessionState as { sessionId?: unknown } | null | undefined;
    const session = await loadOpenSession(userId, claimed?.sessionId);
    const userMessage =
      body.userMessage == null ? undefined : requireText(body.userMessage, "userMessage");

    const concepts = await loadConcepts(userId);
    const sessionState = reconcileSessionState(session, concepts, body.sessionState);

    // ── Socratic dialogue: evaluate the reply, loop or conclude ──────────────
    // The question being answered comes from the stored log, not the request.
    const pending = findPendingBlock(session.messages);
    if (
      userMessage !== undefined &&
      pending?.mode === SessionMode.SOCRATIC &&
      sessionState.currentMode === SessionMode.SOCRATIC &&
      sessionState.currentConcept
    ) {
      const question = typeof pending.response.question === "string" ? pending.response.question : "";
      return await handleSocraticReply(sessionState, concepts, userMessage, question);
    }

    // ── Default: advance to the next block ───────────────────────────────────
    const stateAfterUser = userMessage
      ? recordExchange(sessionState, "user", userMessage)
      : sessionState;

    const { prompt, shouldEndSession } = getNextAction(concepts, stateAfterUser);

    const { data: response, raw } = await callLLMJson(
      {
        systemPrompt: prompt.systemPrompt,
        userMessage: userMessage ?? "Continue.",
        mode: prompt.mode,
      },
      BLOCK_SCHEMAS[prompt.mode]
    );

    const stateAfterAssistant = recordExchange(stateAfterUser, "assistant", raw);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        mode: prompt.mode,
        messages: JSON.parse(JSON.stringify(stateAfterAssistant.exchanges)),
        conceptsHit: stateAfterAssistant.conceptsHit,
        ...(shouldEndSession ? { endedAt: new Date() } : {}),
      },
    });

    return Response.json({
      sessionState: stateAfterAssistant,
      mode: prompt.mode,
      difficulty: prompt.difficultyTier,
      response,
      shouldEndSession,
    });
  } catch (e) {
    return errorResponse(e, "/api/session/next");
  }
}

/**
 * Evaluate a learner's reply within an ongoing Socratic block.
 * Either asks a follow-up question (same block) or concludes and
 * advances to the next block.
 */
async function handleSocraticReply(
  sessionState: SessionState,
  concepts: ConceptSnapshot[],
  userMessage: string,
  question: string
): Promise<Response> {
  const concept = sessionState.currentConcept!;
  const priorTurns = sessionState.socraticTurns ?? [];
  const turnsNow = [...priorTurns, { question, userAnswer: userMessage }];
  const turnsRemaining = SOCRATIC_MAX_TURNS - turnsNow.length;

  const evalPrompt = constructSocraticEvalPrompt(
    concept,
    concept.difficultyTier,
    turnsNow,
    userMessage,
    turnsRemaining
  );

  const { data: evalRes, raw } = await callLLMJson(
    { systemPrompt: evalPrompt, userMessage, mode: SessionMode.SOCRATIC },
    SocraticEvalResponseSchema
  );

  // Record the exchange (learner reply + tutor evaluation) in history.
  const stateAfter = recordExchange(
    recordExchange(sessionState, "user", userMessage),
    "assistant",
    raw
  );

  const forceConclude = turnsNow.length >= SOCRATIC_MAX_TURNS;
  const concluding = evalRes.understanding_achieved || forceConclude || !evalRes.follow_up_question;

  // ── Keep looping: ask the follow-up within the same block ──────────────────
  if (!concluding) {
    const nextState: SessionState = { ...stateAfter, socraticTurns: turnsNow };

    await prisma.session.update({
      where: { id: sessionState.sessionId },
      data: {
        mode: SessionMode.SOCRATIC,
        messages: JSON.parse(JSON.stringify(nextState.exchanges)),
        conceptsHit: nextState.conceptsHit,
      },
    });

    return Response.json({
      continueSocratic: true,
      sessionState: nextState,
      mode: SessionMode.SOCRATIC,
      difficulty: concept.difficultyTier,
      response: {
        question: evalRes.follow_up_question,
        hints: evalRes.hints,
        guidance_direction: evalRes.guidance_direction,
        concepts_probed: [],
      },
    });
  }

  // ── Conclude: reset the dialogue and advance to a fresh concept/block ───────
  const advancingState: SessionState = {
    ...stateAfter,
    socraticTurns: [],
    currentConcept: null,
    exchangeCount: 0,
  };

  const { prompt, shouldEndSession } = getNextAction(concepts, advancingState);

  const { data: response, raw: nextRaw } = await callLLMJson(
    { systemPrompt: prompt.systemPrompt, userMessage: "Continue.", mode: prompt.mode },
    BLOCK_SCHEMAS[prompt.mode]
  );

  const finalState = recordExchange(advancingState, "assistant", nextRaw);

  await prisma.session.update({
    where: { id: sessionState.sessionId },
    data: {
      mode: prompt.mode,
      messages: JSON.parse(JSON.stringify(finalState.exchanges)),
      conceptsHit: finalState.conceptsHit,
      ...(shouldEndSession ? { endedAt: new Date() } : {}),
    },
  });

  return Response.json({
    continueSocratic: false,
    // the answered turn the client should append before showing the new block
    concludedTurn: { question, userAnswer: userMessage },
    sessionState: finalState,
    mode: prompt.mode,
    difficulty: prompt.difficultyTier,
    response,
    shouldEndSession,
  });
}
