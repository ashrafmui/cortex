import { prisma } from "@/lib/prisma";
import { initSession, extractNewConcepts } from "@/lib/orchestrator";
import { BLOCK_SCHEMAS } from "@/lib/orchestrator/schemas";
import { callLLMJson } from "@/lib/llm";
import {
  MAX_GOAL_LENGTH,
  errorResponse,
  loadConcepts,
  readJsonBody,
  requireText,
  requireUserId,
} from "@/lib/session/http";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJsonBody(request);
    const goal = requireText(body.goal, "goal", MAX_GOAL_LENGTH).trim();
    // Only ever matched against this user's own concepts inside initSession.
    const conceptId = typeof body.conceptId === "string" ? body.conceptId : undefined;

    const concepts = await loadConcepts(userId);
    const { sessionState, prompt } = initSession(crypto.randomUUID(), userId, goal, concepts, conceptId);

    const { data: response, raw } = await callLLMJson(
      {
        systemPrompt: prompt.systemPrompt,
        userMessage: `I want to learn about: ${goal}`,
        mode: prompt.mode,
      },
      BLOCK_SCHEMAS[prompt.mode]
    );

    if ("concepts_introduced" in response && response.concepts_introduced.length > 0) {
      const newConcepts = extractNewConcepts(response.concepts_introduced, concepts, goal);
      if (newConcepts.length > 0) {
        await prisma.conceptNode.createMany({
          data: newConcepts.map((c) => ({ userId, topic: c.topic, parentTopic: c.parentTopic })),
          skipDuplicates: true,
        });
      }
    }

    const conceptTopic = sessionState.currentConcept?.topic;
    const exchanges = [
      { role: "user", content: goal, mode: prompt.mode, concept: conceptTopic, timestamp: new Date() },
      { role: "assistant", content: raw, mode: prompt.mode, concept: conceptTopic, timestamp: new Date() },
    ];

    await prisma.session.create({
      data: {
        id: sessionState.sessionId,
        userId,
        goal,
        mode: prompt.mode,
        messages: JSON.parse(JSON.stringify(exchanges)),
        conceptsHit: sessionState.conceptsHit,
      },
    });

    return Response.json({
      sessionState: { ...sessionState, exchanges, totalExchanges: 2, exchangeCount: 2 },
      mode: prompt.mode,
      difficulty: prompt.difficultyTier,
      response,
    });
  } catch (e) {
    return errorResponse(e, "/api/session/start");
  }
}
