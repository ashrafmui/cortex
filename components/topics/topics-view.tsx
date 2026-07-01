'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRightIcon } from 'lucide-react'

import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'
import { Topic, statusColors } from '@/lib/data'
import { TopicMapPreview } from './topic-map-preview'

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

      {/* Map preview + compact topic list, side by side */}
      <div className="mt-6 flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Knowledge-graph preview → full Topic Map */}
        <div className="w-full lg:w-1/3 lg:sticky lg:top-6 shrink-0">
          <TopicMapPreview topics={topics} />
        </div>

        {/* Compact topic list (dashboard-style rows) */}
        <div className="w-full lg:flex-1 rounded-xl border bg-card p-1.5">
        {topics.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No concepts yet. Start a session to build your graph.
          </p>
        ) : (
          topics.map((topic) => {
            const colors = statusColors[topic.status]
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => router.push(`/topics/${topic.id}`)}
                className="group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg px-4 py-2 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-900/40"
              >
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out',
                    colors.bg,
                  )}
                  style={{ width: animated ? `${topic.mastery}%` : '0%' }}
                />
                <span className="relative z-10 truncate text-sm font-medium text-black">
                  {topic.name}
                </span>
                <div className="relative z-10 flex shrink-0 items-center gap-2">
                  <NumberTicker
                    value={topic.mastery}
                    className={cn('tabular-nums font-medium', colors.text)}
                  />
                  <ChevronRightIcon
                    strokeWidth={1.5}
                    className="h-4 w-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                </div>
              </button>
            )
          })
        )}
        </div>
      </div>
    </div>
  )
}
