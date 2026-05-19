import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import {
  getCurrentUser,
  formatShortDate,
  getMasteryHistoryForConcept,
  getRecentReviewsForConcept,
  getConceptDeltaPct,
} from '@/lib/queries'
import TopicDetailView, { TopicDetail } from '@/components/topics/topic-detail-view'

function NotFound({ id }: { id: string }) {
  return (
    <div className="w-full">
      <Link
        href="/topics"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Topics
      </Link>
      <h1 className="text-4xl font-light mt-4">Topic not found</h1>
      <p className="text-muted-foreground mt-2">No topic with id {id}.</p>
    </div>
  )
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { dbUser } = await getCurrentUser()
  if (!dbUser) return <NotFound id={id} />

  const concept = await prisma.conceptNode.findFirst({
    where: { id, userId: dbUser.id },
  })
  if (!concept) return <NotFound id={id} />

  const [history, recentReviews, delta] = await Promise.all([
    getMasteryHistoryForConcept(concept.id),
    getRecentReviewsForConcept(concept.id, dbUser.id),
    getConceptDeltaPct(concept.id),
  ])

  const masteryPct = Math.round(concept.mastery * 100)
  const status: TopicDetail['status'] =
    masteryPct >= 70 ? 'strong' : masteryPct >= 40 ? 'developing' : 'weak'

  const nextReview = concept.lastReviewed
    ? new Date(
        concept.lastReviewed.getTime() +
          concept.reviewInterval * 24 * 60 * 60 * 1000,
      )
    : null

  const topic: TopicDetail = {
    id: concept.id,
    name: concept.topic,
    mastery: masteryPct,
    status,
    lastReviewed: formatShortDate(concept.lastReviewed),
    exposureCount: concept.exposureCount,
    delta,
    reviewIntervalDays: concept.reviewInterval,
    nextReview: formatShortDate(nextReview),
    history,
    recentReviews,
  }

  return <TopicDetailView topic={topic} />
}
