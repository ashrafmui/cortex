import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { initSession, extractNewConcepts } from "@/lib/orchestrator";
import { dbToSnapshot } from "@/lib/orchestrator/db-mapping";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { goal?: unknown } | null;
  const goal = body?.goal;
  if (typeof goal !== "string" || goal.trim() === "") {
    return Response.json({ error: "Missing 'goal' in request body" }, { status: 400 });
  }

  try {
    const concepts = (await prisma.conceptNode.findMany({ where: { userId: user.id } }))
      .map(dbToSnapshot);

    const { sessionState, prompt } = initSession(crypto.randomUUID(), user.id, goal, concepts);

    const raw = await callLLM({
      systemPrompt: prompt.systemPrompt,
      userMessage: `I want to learn about: ${goal}`,
      mode: prompt.mode,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "LLM returned malformed JSON", raw }, { status: 502 });
    }

    if (Array.isArray(parsed.concepts_introduced)) {
      const newConcepts = extractNewConcepts(parsed.concepts_introduced as string[], concepts, goal);
      if (newConcepts.length > 0) {
        await prisma.conceptNode.createMany({
          data: newConcepts.map((c) => ({ userId: user.id, topic: c.topic, parentTopic: c.parentTopic })),
          skipDuplicates: true,
        });
      }
    }

    const exchanges = [
      { role: "user", content: goal, mode: prompt.mode, timestamp: new Date() },
      { role: "assistant", content: raw, mode: prompt.mode, timestamp: new Date() },
    ];

    await prisma.session.create({
      data: {
        id: sessionState.sessionId,
        userId: user.id,
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
      response: parsed,
    });
  } catch (e) {
    console.error("[/api/session/start]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
