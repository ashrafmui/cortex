import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { dbToSnapshot } from "@/lib/orchestrator/db-mapping";
import { rehydrateSession } from "@/lib/session/rehydrate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const concepts = (await prisma.conceptNode.findMany({ where: { userId: user.id } }))
      .map(dbToSnapshot);

    const { goal, sessionState, blocks, sessionEnded } = rehydrateSession(session, concepts);

    return Response.json({ goal, sessionState, blocks, sessionEnded });
  } catch (e) {
    console.error("[/api/session/[sessionId]]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
