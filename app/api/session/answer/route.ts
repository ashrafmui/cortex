import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  constructGradePrompt,
  getNextAction,
  processQuizResult,
  recordExchange,
  type SessionState,
} from "@/lib/orchestrator";
import { dbToSnapshot } from "@/lib/orchestrator/db-mapping";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        sessionState?: SessionState;
        answer?: string;
        question?: string;
        rubric?: string;
        confidence?: "low" | "medium" | "high";
      }
    | null;

  const { sessionState, answer, question, rubric, confidence } = body ?? {};
  if (
    !sessionState ||
    sessionState.userId !== user.id ||
    !sessionState.currentConcept ||
    typeof answer !== "string" ||
    typeof question !== "string" ||
    typeof rubric !== "string"
  ) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const gradePrompt = constructGradePrompt(sessionState.currentConcept, question, answer, rubric);

    const raw = await callLLM({
      systemPrompt: gradePrompt,
      userMessage: answer,
      mode: "GRADE",
    });

    let grade: { score: number; reasoning: string; correct_answer: string };
    try {
      grade = JSON.parse(raw);
    } catch {
      return Response.json({ error: "LLM returned malformed grade JSON", raw }, { status: 502 });
    }

    const { updatedConcept } = processQuizResult(sessionState.currentConcept, grade.score, confidence);

    await prisma.$transaction([
      prisma.conceptNode.update({
        where: { id: sessionState.currentConcept.id },
        data: updatedConcept,
      }),
      prisma.quizResult.create({
        data: {
          conceptId: sessionState.currentConcept.id,
          score: grade.score,
          confidence: confidence ?? null,
          question,
          answer,
          feedback: grade.reasoning,
        },
      }),
    ]);

    const stateAfter = recordExchange(
      recordExchange(sessionState, "user", answer),
      "assistant",
      raw
    );

    const concepts = (await prisma.conceptNode.findMany({ where: { userId: user.id } }))
      .map(dbToSnapshot);

    const { prompt, shouldEndSession } = getNextAction(concepts, stateAfter);

    await prisma.session.update({
      where: { id: sessionState.sessionId },
      data: {
        mode: prompt.mode,
        messages: JSON.parse(JSON.stringify(stateAfter.exchanges)),
        conceptsHit: stateAfter.conceptsHit,
      },
    });

    return Response.json({
      grade,
      masteryUpdate: updatedConcept,
      nextAction: {
        mode: prompt.mode,
        difficulty: prompt.difficultyTier,
        systemPrompt: prompt.systemPrompt,
      },
      sessionState: stateAfter,
      shouldEndSession,
    });
  } catch (e) {
    console.error("[/api/session/answer]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
