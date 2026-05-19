import { getCurrentUser } from '@/lib/queries'
import { prisma } from '@/lib/prisma'
import { toTopic } from '@/lib/queries'
import TopicsView from '@/components/topics/topics-view'

export default async function TopicsPage() {
  const { dbUser } = await getCurrentUser()
  if (!dbUser) return <TopicsView topics={[]} />

  const concepts = await prisma.conceptNode.findMany({
    where: { userId: dbUser.id },
    orderBy: { mastery: 'desc' },
  })
  const topics = concepts.map((c) =>
    toTopic({
      id: c.id,
      topic: c.topic,
      mastery: c.mastery,
      lastReviewed: c.lastReviewed,
      exposureCount: c.exposureCount,
    }),
  )
  return <TopicsView topics={topics} />
}
