import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getNextAction, recordExchange, type SessionState } from "@/lib/orchestrator";
import { dbToSnapshot } from "@/lib/orchestrator/db-mapping";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { sessionState?: SessionState; userMessage?: string }
    | null;
  const sessionState = body?.sessionState;
  if (!sessionState || sessionState.userId !== user.id) {
    return Response.json({ error: "Invalid sessionState" }, { status: 400 });
  }

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
}
