import { prisma } from "@/lib/prisma";
import {
  SessionMode,
  constructGradePrompt,
  getNextAction,
  processQuizResult,
  recordExchange,
} from "@/lib/orchestrator";
import { QuizGradeResponseSchema } from "@/lib/orchestrator/schemas";
import { callLLMJson } from "@/lib/llm";
import {
  HttpError,
  errorResponse,
  loadConcepts,
  loadOpenSession,
  readJsonBody,
  requireText,
  requireUserId,
} from "@/lib/session/http";
import { findPendingBlock, reconcileSessionState } from "@/lib/session/server-state";

const CONFIDENCE = new Set(["low", "medium", "high"]);

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJsonBody(request);
    const claimed = body.sessionState as { sessionId?: unknown } | null | undefined;
    const session = await loadOpenSession(userId, claimed?.sessionId);
    const answer = requireText(body.answer, "answer");
    const confidence = CONFIDENCE.has(body.confidence as string)
      ? (body.confidence as "low" | "medium" | "high")
      : undefined;

    // Grade only the question the stored log says is waiting. The question,
    // rubric and concept all come from the database, never from the request,
    // and an already-graded question can't be answered again.
    const pending = findPendingBlock(session.messages);
    if (
      !pending?.quizMeta ||
      (pending.mode !== SessionMode.QUIZ && pending.mode !== SessionMode.REVIEW)
    ) {
      throw new HttpError(409, "There's no question waiting for an answer");
    }

    const concepts = await loadConcepts(userId);
    const sessionState = reconcileSessionState(session, concepts, body.sessionState);
    const concept =
      concepts.find((c) => c.topic === pending.concept) ??
      concepts.find((c) => c.id === sessionState.currentConcept?.id);
    if (!concept) {
      throw new HttpError(409, "Couldn't find the concept this question is about");
    }

    const { question, rubric } = pending.quizMeta;
    const { data: grade, raw } = await callLLMJson(
      {
        systemPrompt: constructGradePrompt(concept, question, answer, rubric),
        userMessage: answer,
        mode: "GRADE",
      },
      QuizGradeResponseSchema
    );

    const { updatedConcept } = processQuizResult(concept, grade.score, confidence);

    const stateAfter = recordExchange(
      recordExchange({ ...sessionState, currentConcept: concept }, "user", answer),
      "assistant",
      raw
    );

    const conceptsAfter = concepts.map((c) =>
      c.id === concept.id ? { ...c, ...updatedConcept } : c
    );
    const { prompt, shouldEndSession } = getNextAction(conceptsAfter, stateAfter);

    // One transaction: the mastery update, the quiz record and the session log
    // land together, so a grade is never applied without being logged.
    await prisma.$transaction([
      prisma.conceptNode.update({
        where: { id: concept.id },
        data: updatedConcept,
      }),
      prisma.quizResult.create({
        data: {
          conceptId: concept.id,
          score: grade.score,
          confidence: confidence ?? null,
          question,
          answer,
          feedback: grade.reasoning,
        },
      }),
      prisma.session.update({
        where: { id: session.id },
        data: {
          mode: prompt.mode,
          messages: JSON.parse(JSON.stringify(stateAfter.exchanges)),
          conceptsHit: stateAfter.conceptsHit,
          ...(shouldEndSession ? { endedAt: new Date() } : {}),
        },
      }),
    ]);

    return Response.json({
      grade,
      masteryUpdate: updatedConcept,
      nextAction: { mode: prompt.mode, difficulty: prompt.difficultyTier },
      sessionState: stateAfter,
      shouldEndSession,
    });
  } catch (e) {
    return errorResponse(e, "/api/session/answer");
  }
}
