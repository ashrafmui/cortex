'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Bar, BarChart, Cell, XAxis } from 'recharts'

import { NumberTicker } from '@/components/ui/number-ticker'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

type Status = 'strong' | 'developing' | 'weak'
type Mode = 'TEACH' | 'QUIZ' | 'SOCRATIC' | 'REVIEW'

export type TopicDetail = {
  id: string
  name: string
  mastery: number
  status: Status
  lastReviewed: string
  exposureCount: number
  delta: number
  reviewIntervalDays: number
  nextReview: string
  history: { label: string; mastery: number }[]
  recentReviews: { id: string; date: string; mode: Mode; score?: number }[]
}

const statusColors = {
  strong: { bg: 'bg-green-200', text: 'text-green-600' },
  developing: { bg: 'bg-yellow-200', text: 'text-yellow-600' },
  weak: { bg: 'bg-red-200', text: 'text-red-600' },
} as const

const masteryTier = (m: number): Status =>
  m >= 70 ? 'strong' : m >= 40 ? 'developing' : 'weak'

const historyChartConfig = {
  mastery: { label: 'Mastery' },
  strong: { label: 'Strong', color: '#bbf7d0' },
  developing: { label: 'Developing', color: '#fef08a' },
  weak: { label: 'Weak', color: '#fecaca' },
} satisfies ChartConfig

export default function TopicDetailView({ topic }: { topic: TopicDetail }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  const colors = statusColors[topic.status]

  return (
    <div className="w-full">
      <Link
        href="/topics"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Topics
      </Link>

      <div className="mt-3 flex flex-col sm:flex-row w-full justify-between sm:items-end">
        <div>
          <h1 className="text-4xl font-light">{topic.name}</h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {topic.status} · {topic.exposureCount} reviews · Last reviewed {topic.lastReviewed}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-5 w-full">
        <Card className="min-w-0 flex-1 sm:max-w-sm">
          <CardHeader className="flex flex-row items-center justify-between w-full">
            <CardTitle className="text-2xl">Mastery</CardTitle>
            <NumberTicker value={topic.mastery} className={cn('text-2xl', colors.text)} />
          </CardHeader>
          <CardDescription
            className={cn(
              'px-4',
              topic.delta >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium',
            )}
          >
            {topic.delta >= 0 ? '↑' : '↓'} {Math.abs(topic.delta)}% from last week
          </CardDescription>
          <CardContent className="flex flex-col gap-3">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out',
                  colors.bg,
                )}
                style={{ width: animated ? `${topic.mastery}%` : '0%' }}
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Review interval</span>
                <span>{topic.reviewIntervalDays}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next review</span>
                <span>{topic.nextReview}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total reviews</span>
                <span>{topic.exposureCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 flex-1">
          <CardHeader>
            <CardTitle className="text-2xl">Mastery History</CardTitle>
            <CardDescription>Quiz scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            {topic.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quiz history yet.</p>
            ) : (
              <ChartContainer config={historyChartConfig} className="h-[200px] w-full">
                <BarChart data={topic.history} margin={{ left: 4, right: 4, top: 8 }}>
                  <defs>
                    {(['strong', 'developing', 'weak'] as const).map((tier) => (
                      <linearGradient
                        key={tier}
                        id={`fill-history-${tier}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={`var(--color-${tier})`} stopOpacity={1} />
                        <stop offset="100%" stopColor={`var(--color-${tier})`} stopOpacity={0.25} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        labelFormatter={(label) => `${label} · mastery`}
                      />
                    }
                  />
                  <Bar dataKey="mastery" radius={[6, 6, 0, 0]}>
                    {topic.history.map((point) => (
                      <Cell
                        key={point.label}
                        fill={`url(#fill-history-${masteryTier(point.mastery)})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Recent Activity</CardTitle>
          <CardDescription>Latest sessions touching this topic</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {topic.recentReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            topic.recentReviews.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  'flex items-center justify-between py-3 text-sm',
                  i !== 0 && 'border-t',
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {r.mode.charAt(0) + r.mode.slice(1).toLowerCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.date}</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {r.score !== undefined ? `${r.score} / 10` : '—'}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
