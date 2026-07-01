import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  getNextAction,
  recordExchange,
  constructSocraticEvalPrompt,
  SOCRATIC_MAX_TURNS,
  SessionMode,
  type SessionState,
} from "@/lib/orchestrator";
import type { SocraticEvalResponse } from "@/lib/orchestrator/types";
import { dbToSnapshot } from "@/lib/orchestrator/db-mapping";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { sessionState?: SessionState; userMessage?: string; question?: string }
    | null;
  const sessionState = body?.sessionState;
  if (!sessionState || sessionState.userId !== user.id) {
    return Response.json({ error: "Invalid sessionState" }, { status: 400 });
  }

  try {
    // ── Socratic dialogue: evaluate the reply, loop or conclude ──────────────
    if (
      sessionState.currentMode === SessionMode.SOCRATIC &&
      sessionState.currentConcept &&
      typeof body?.userMessage === "string" &&
      typeof body?.question === "string"
    ) {
      return await handleSocraticReply(user.id, sessionState, body.userMessage, body.question);
    }

    // ── Default: advance to the next block ───────────────────────────────────
    const concepts = (await prisma.conceptNode.findMany({ where: { userId: user.id } }))
      .map(dbToSnapshot);

    const stateAfterUser = body?.userMessage
      ? recordExchange(sessionState, "user", body.userMessage)
      : sessionState;

    const { prompt, shouldEndSession } = getNextAction(concepts, stateAfterUser);

    const raw = await callLLM({
      systemPrompt: prompt.systemPrompt,
      userMessage: body?.userMessage ?? "Continue.",
      mode: prompt.mode,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "LLM returned malformed JSON", raw }, { status: 502 });
    }

    const stateAfterAssistant = recordExchange(stateAfterUser, "assistant", raw);

    await prisma.session.update({
      where: { id: sessionState.sessionId },
      data: {
        mode: prompt.mode,
        messages: JSON.parse(JSON.stringify(stateAfterAssistant.exchanges)),
        conceptsHit: stateAfterAssistant.conceptsHit,
      },
    });

    return Response.json({
      sessionState: stateAfterAssistant,
      mode: prompt.mode,
      difficulty: prompt.difficultyTier,
      response: parsed,
      shouldEndSession,
    });
  } catch (e) {
    console.error("[/api/session/next]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Evaluate a learner's reply within an ongoing Socratic block.
 * Either asks a follow-up question (same block) or concludes and
 * advances to the next block.
 */
async function handleSocraticReply(
  userId: string,
  sessionState: SessionState,
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

  const raw = await callLLM({
    systemPrompt: evalPrompt,
    userMessage,
    mode: SessionMode.SOCRATIC,
  });

  let evalRes: SocraticEvalResponse;
  try {
    evalRes = JSON.parse(raw);
  } catch {
    return Response.json({ error: "LLM returned malformed Socratic eval JSON", raw }, { status: 502 });
  }

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
        hints: evalRes.hints ?? [],
        guidance_direction: evalRes.guidance_direction ?? "",
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

  const concepts = (await prisma.conceptNode.findMany({ where: { userId } }))
    .map(dbToSnapshot);

  const { prompt, shouldEndSession } = getNextAction(concepts, advancingState);

  const nextRaw = await callLLM({
    systemPrompt: prompt.systemPrompt,
    userMessage: "Continue.",
    mode: prompt.mode,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(nextRaw);
  } catch {
    return Response.json({ error: "LLM returned malformed JSON", raw: nextRaw }, { status: 502 });
  }

  const finalState = recordExchange(advancingState, "assistant", nextRaw);

  await prisma.session.update({
    where: { id: sessionState.sessionId },
    data: {
      mode: prompt.mode,
      messages: JSON.parse(JSON.stringify(finalState.exchanges)),
      conceptsHit: finalState.conceptsHit,
    },
  });

  return Response.json({
    continueSocratic: false,
    // the answered turn the client should append before showing the new block
    concludedTurn: { question, userAnswer: userMessage },
    sessionState: finalState,
    mode: prompt.mode,
    difficulty: prompt.difficultyTier,
    response: parsed,
    shouldEndSession,
  });
}
