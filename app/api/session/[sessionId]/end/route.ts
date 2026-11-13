import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse, requireUserId } from "@/lib/session/http";

/**
 * Mark a session as ended. Idempotent: ending an already-ended session keeps
 * its original end time.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const userId = await requireUserId();

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, endedAt: true },
    });
    if (!session) throw new HttpError(404, "Session not found");

    const endedAt =
      session.endedAt ??
      (
        await prisma.session.update({
          where: { id: session.id },
          data: { endedAt: new Date() },
          select: { endedAt: true },
        })
      ).endedAt;

    return Response.json({ endedAt });
  } catch (e) {
    return errorResponse(e, "/api/session/[sessionId]/end");
  }
}
