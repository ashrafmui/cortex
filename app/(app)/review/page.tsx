import { getCurrentUser, getDueForReview } from '@/lib/queries'
import ReviewView from '@/components/review/review-view'

export default async function ReviewPage() {
  const { dbUser } = await getCurrentUser()
  if (!dbUser) {
    return <ReviewView queue={[]} delta={0} />
  }
  const queue = await getDueForReview(dbUser.id)
  return <ReviewView queue={queue} delta={0} />
}
