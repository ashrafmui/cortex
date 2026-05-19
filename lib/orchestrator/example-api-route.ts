// ============================================================================
// Example: Next.js API Route — /api/session/next
// ============================================================================
// This is NOT production code — it's a reference showing how to wire the
// orchestrator into your Next.js API routes with Prisma and the Anthropic SDK.
//
// Copy this into your app/api/session/next/route.ts and adapt to your auth
// and error handling patterns.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";       // your auth helper
// import { prisma } from "@/lib/prisma";   // your Prisma client
// import Anthropic from "@anthropic-ai/sdk";

import {
  initSession,
  getNextAction,
  recordExchange,
  processQuizResult,
  constructGradePrompt,
  extractNewConcepts,
  type ConceptSnapshot,
  type SessionState,
} from "@/lib/orchestrator";

// const anthropic = new Anthropic();

// ============================================================================
// POST /api/session/start — Start a new learning session
// ============================================================================

export async function startSession(request: NextRequest) {
  // --- Auth ---
  // const session = await auth();
  // if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // const userId = session.user.id;

  const userId = "demo-user"; // placeholder
  const { goal } = await request.json();

  if (!goal || typeof goal !== "string") {
    return NextResponse.json(
      { error: "Missing 'goal' in request body" },
      { status: 400 }
    );
  }

  // --- Load the user's knowledge graph ---
  // const dbConcepts = await prisma.conceptNode.findMany({
  //   where: { userId },
  // });
  // const concepts: ConceptSnapshot[] = dbConcepts.map(mapDbToSnapshot);

  const concepts: ConceptSnapshot[] = []; // empty for demo

  // --- Initialize the session ---
  const { sessionState, prompt } = initSession(
    crypto.randomUUID(),
    userId,
    goal,
    concepts
  );

  // --- Call the LLM with the constructed prompt ---
  // const llmResponse = await anthropic.messages.create({
  //   model: "claude-sonnet-4-20250514",
  //   max_tokens: 1024,
  //   system: prompt.systemPrompt,
  //   messages: [{ role: "user", content: `I want to learn about: ${goal}` }],
  // });
  //
  // const assistantContent = llmResponse.content[0].type === "text"
  //   ? llmResponse.content[0].text
  //   : "";

  const assistantContent = "{}"; // placeholder

  // --- Parse the structured JSON response ---
  let parsed;
  try {
    parsed = JSON.parse(assistantContent);
  } catch {
    // Retry with stricter prompt or fallback to raw text
    return NextResponse.json(
      { error: "LLM returned malformed JSON", raw: assistantContent },
      { status: 502 }
    );
  }

  // --- Record the exchange ---
  const updatedState = recordExchange(
    recordExchange(sessionState, "user", goal),
    "assistant",
    assistantContent
  );

  // --- Persist session to DB ---
  // await prisma.session.create({
  //   data: {
  //     id: updatedState.sessionId,
  //     userId,
  //     goal,
  //     mode: updatedState.currentMode,
  //     messages: updatedState.exchanges,
  //     conceptsHit: updatedState.conceptsHit,
  //   },
  // });

  // --- Extract and upsert new concepts from TEACH response ---
  if (parsed.concepts_introduced) {
    const newConcepts = extractNewConcepts(
      parsed.concepts_introduced,
      concepts,
      goal
    );

    // for (const nc of newConcepts) {
    //   await prisma.conceptNode.upsert({
    //     where: { userId_topic: { userId, topic: nc.topic } },
    //     create: { userId, topic: nc.topic, parentTopic: nc.parentTopic },
    //     update: {},
    //   });
    // }
  }

  return NextResponse.json({
    sessionState: updatedState,
    mode: prompt.mode,
    difficulty: prompt.difficultyTier,
    response: parsed,
  });
}

// ============================================================================
// POST /api/session/answer — Submit an answer to a quiz/review question
// ============================================================================

export async function submitAnswer(request: NextRequest) {
  const { sessionState, answer, question, rubric, confidence } =
    (await request.json()) as {
      sessionState: SessionState;
      answer: string;
      question: string;
      rubric: string;
      confidence?: "low" | "medium" | "high";
    };

  if (!sessionState?.currentConcept) {
    return NextResponse.json(
      { error: "No active concept in session" },
      { status: 400 }
    );
  }

  // --- Build grading prompt and call the LLM ---
  const gradePrompt = constructGradePrompt(
    sessionState.currentConcept,
    question,
    answer,
    rubric
  );

  // const llmResponse = await anthropic.messages.create({
  //   model: "claude-sonnet-4-20250514",
  //   max_tokens: 1024,
  //   system: gradePrompt,
  //   messages: [{ role: "user", content: answer }],
  // });

  // --- Parse grade ---
  // const gradeJson = JSON.parse(llmResponse.content[0].text);
  const gradeJson = { score: 0.7, reasoning: "demo", correct_answer: "demo" };

  // --- Process quiz result: update mastery + SM-2 ---
  const { updatedConcept, sm2Result } = processQuizResult(
    sessionState.currentConcept,
    gradeJson.score,
    confidence
  );

  // --- Persist mastery update ---
  // await prisma.conceptNode.update({
  //   where: { id: sessionState.currentConcept.id },
  //   data: updatedConcept,
  // });

  // --- Record quiz result ---
  // await prisma.quizResult.create({
  //   data: {
  //     conceptId: sessionState.currentConcept.id,
  //     score: gradeJson.score,
  //     confidence,
  //     question,
  //     answer,
  //     feedback: gradeJson.reasoning,
  //   },
  // });

  // --- Record exchange and get next action ---
  const stateAfterAnswer = recordExchange(
    recordExchange(sessionState, "user", answer),
    "assistant",
    JSON.stringify(gradeJson)
  );

  // Reload concepts with updated mastery for next decision
  // const freshConcepts = await prisma.conceptNode.findMany({
  //   where: { userId: sessionState.userId },
  // });
  const freshConcepts: ConceptSnapshot[] = [];

  const { decision, prompt, shouldEndSession } = getNextAction(
    freshConcepts,
    stateAfterAnswer
  );

  return NextResponse.json({
    grade: gradeJson,
    masteryUpdate: updatedConcept,
    sm2: sm2Result,
    nextAction: {
      mode: decision.mode,
      difficulty: decision.difficultyTier,
      reason: decision.reason,
    },
    shouldEndSession,
    sessionState: stateAfterAnswer,
  });
}
