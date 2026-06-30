import { getCurrentUser } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import TopicMapView from "@/components/topic-map/topic-map-view";

export default async function TopicMapPage() {
  const { dbUser } = await getCurrentUser();
  if (!dbUser) return <TopicMapView groups={[]} />;

  const concepts = await prisma.conceptNode.findMany({
    where: { userId: dbUser.id },
    orderBy: { mastery: "desc" },
    select: {
      id: true,
      topic: true,
      parentTopic: true,
      mastery: true,
      difficultyTier: true,
    },
  });

  // Group by parentTopic
  const groupMap = new Map<string, typeof concepts>();
  for (const c of concepts) {
    const key = c.parentTopic ?? "General";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(c);
  }

  const groups = Array.from(groupMap.entries()).map(([name, nodes]) => ({
    name,
    nodes,
  }));

  return <TopicMapView groups={groups} />;
}
