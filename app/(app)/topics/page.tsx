'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRightIcon } from 'lucide-react'

import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'

type Topic = {
  id: string
  name: string
  mastery: number
  status: 'strong' | 'developing' | 'weak'
  lastReviewed: string
  exposureCount: number
}

const MOCK_TOPICS: Topic[] = [
  { id: '1', name: 'Pointers in C', mastery: 82, status: 'strong', lastReviewed: 'Apr 22', exposureCount: 12 },
  { id: '2', name: 'Memory Management', mastery: 45, status: 'developing', lastReviewed: 'Apr 20', exposureCount: 7 },
  { id: '3', name: 'Linked Lists', mastery: 71, status: 'strong', lastReviewed: 'Apr 21', exposureCount: 9 },
  { id: '4', name: 'Recursion', mastery: 18, status: 'weak', lastReviewed: 'Apr 12', exposureCount: 4 },
  { id: '5', name: 'Binary Trees', mastery: 25, status: 'weak', lastReviewed: 'Apr 10', exposureCount: 5 },
  { id: '6', name: 'Dynamic Programming', mastery: 31, status: 'developing', lastReviewed: 'Apr 14', exposureCount: 6 },
]

const statusColors = {
  strong: { bg: 'bg-green-200', text: 'text-green-600' },
  developing: { bg: 'bg-yellow-200', text: 'text-yellow-600' },
  weak: { bg: 'bg-red-200', text: 'text-red-600' },
} as const

export default function TopicsPage() {
  const router = useRouter()
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row w-full justify-between sm:items-end">
        <h1 className="text-4xl font-light">Topics</h1>
        <div className="text-sm text-muted-foreground">
          {MOCK_TOPICS.length} topics
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {MOCK_TOPICS.map((topic) => {
          const colors = statusColors[topic.status]
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => router.push(`/topics/${topic.id}`)}
              className="group relative w-full overflow-hidden rounded-xl border bg-card text-left cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div
                className={cn(
                  'absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out',
                  colors.bg
                )}
                style={{ width: animated ? `${topic.mastery}%` : '0%' }}
              />
              <div className="relative flex items-center justify-between gap-4 px-6 py-5">
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-medium text-black truncate">
                    {topic.name}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {topic.status} · {topic.exposureCount} reviews · Last reviewed {topic.lastReviewed}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <NumberTicker
                    value={topic.mastery}
                    className={cn('text-2xl tabular-nums font-medium', colors.text)}
                  />
                  <ChevronRightIcon
                    strokeWidth={1.5}
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
