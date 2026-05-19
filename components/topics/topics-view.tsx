'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRightIcon } from 'lucide-react'

import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'
import { Topic } from '@/lib/data'

const statusColors = {
  strong: { bg: 'bg-green-200', text: 'text-green-600' },
  developing: { bg: 'bg-yellow-200', text: 'text-yellow-600' },
  weak: { bg: 'bg-red-200', text: 'text-red-600' },
} as const

export default function TopicsView({ topics }: { topics: Topic[] }) {
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
        <div className="text-sm text-muted-foreground">{topics.length} topics</div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No concepts yet. Start a session to build your graph.</p>
        ) : (
          topics.map((topic) => {
            const colors = statusColors[topic.status]
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => router.push(`/topics/${topic.id}`)}
                className="group relative w-full overflow-y-auto rounded-xl border bg-card text-left cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out',
                    colors.bg,
                  )}
                  style={{ width: animated ? `${topic.mastery}%` : '0%' }}
                />
                <div className="relative flex items-center justify-between gap-4 px-6 py-5">
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-medium text-black truncate">{topic.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {topic.status} · {topic.exposureCount ?? 0} reviews · Last reviewed {topic.lastReviewed}
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
          })
        )}
      </div>
    </div>
  )
}
