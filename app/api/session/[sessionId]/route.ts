import { prisma } from "@/lib/prisma";
import { rehydrateSession } from "@/lib/session/rehydrate";
import { HttpError, errorResponse, loadConcepts, requireUserId } from "@/lib/session/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const userId = await requireUserId();

    const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new HttpError(404, "Session not found");

    const concepts = await loadConcepts(userId);
    const { goal, sessionState, blocks, sessionEnded } = rehydrateSession(session, concepts);

    return Response.json({ goal, sessionState, blocks, sessionEnded });
  } catch (e) {
    return errorResponse(e, "/api/session/[sessionId]");
  }
}
