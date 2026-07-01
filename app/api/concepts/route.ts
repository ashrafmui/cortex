import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const concepts = await prisma.conceptNode.findMany({
      where: { userId: user.id },
      orderBy: { mastery: "desc" },
      select: {
        id: true,
        topic: true,
        parentTopic: true,
        mastery: true,
        difficultyTier: true,
        exposureCount: true,
        lastReviewed: true,
        reviewInterval: true,
      },
    });
    return Response.json({ concepts });
  } catch (e) {
    console.error("[/api/concepts]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
