import { getCurrentUser } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import TopicMapView from "@/components/topic-map/topic-map-view";

export default async function TopicMapPage() {
  const { dbUser } = await getCurrentUser();
  if (!dbUser) return <TopicMapView concepts={[]} />;

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

  return <TopicMapView concepts={concepts} />;
}
