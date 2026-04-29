'use client'

import { use, useEffect, useState } from 'react'
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

type Topic = {
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

const MOCK_TOPICS: Record<string, Topic> = {
  '1': {
    id: '1', name: 'Pointers in C', mastery: 82, status: 'strong',
    lastReviewed: 'Apr 22', exposureCount: 12, delta: 5,
    reviewIntervalDays: 14, nextReview: 'May 6',
    history: [
      { label: 'Mar 10', mastery: 32 },
      { label: 'Mar 18', mastery: 48 },
      { label: 'Mar 26', mastery: 55 },
      { label: 'Apr 02', mastery: 64 },
      { label: 'Apr 09', mastery: 70 },
      { label: 'Apr 15', mastery: 75 },
      { label: 'Apr 19', mastery: 78 },
      { label: 'Apr 22', mastery: 82 },
    ],
    recentReviews: [
      { id: 'r1', date: 'Apr 22', mode: 'QUIZ', score: 8 },
      { id: 'r2', date: 'Apr 19', mode: 'TEACH' },
      { id: 'r3', date: 'Apr 15', mode: 'QUIZ', score: 7 },
      { id: 'r4', date: 'Apr 09', mode: 'SOCRATIC' },
    ],
  },
  '2': {
    id: '2', name: 'Memory Management', mastery: 45, status: 'developing',
    lastReviewed: 'Apr 20', exposureCount: 7, delta: 8,
    reviewIntervalDays: 7, nextReview: 'Apr 27',
    history: [
      { label: 'Mar 15', mastery: 22 },
      { label: 'Mar 24', mastery: 28 },
      { label: 'Apr 02', mastery: 30 },
      { label: 'Apr 08', mastery: 34 },
      { label: 'Apr 14', mastery: 38 },
      { label: 'Apr 20', mastery: 45 },
    ],
    recentReviews: [
      { id: 'r1', date: 'Apr 20', mode: 'QUIZ', score: 5 },
      { id: 'r2', date: 'Apr 14', mode: 'TEACH' },
      { id: 'r3', date: 'Apr 08', mode: 'QUIZ', score: 4 },
    ],
  },
  '3': {
    id: '3', name: 'Linked Lists', mastery: 71, status: 'strong',
    lastReviewed: 'Apr 21', exposureCount: 9, delta: 3,
    reviewIntervalDays: 10, nextReview: 'May 1',
    history: [
      { label: 'Mar 12', mastery: 30 },
      { label: 'Mar 22', mastery: 42 },
      { label: 'Apr 01', mastery: 55 },
      { label: 'Apr 09', mastery: 62 },
      { label: 'Apr 15', mastery: 68 },
      { label: 'Apr 21', mastery: 71 },
    ],
    recentReviews: [
      { id: 'r1', date: 'Apr 21', mode: 'QUIZ', score: 7 },
      { id: 'r2', date: 'Apr 15', mode: 'SOCRATIC' },
      { id: 'r3', date: 'Apr 09', mode: 'TEACH' },
    ],
  },
  '4': {
    id: '4', name: 'Recursion', mastery: 18, status: 'weak',
    lastReviewed: 'Apr 12', exposureCount: 4, delta: -3,
    reviewIntervalDays: 2, nextReview: 'Apr 24',
    history: [
      { label: 'Mar 28', mastery: 12 },
      { label: 'Apr 03', mastery: 15 },
      { label: 'Apr 08', mastery: 21 },
      { label: 'Apr 12', mastery: 18 },
    ],
    recentReviews: [
      { id: 'r1', date: 'Apr 12', mode: 'QUIZ', score: 2 },
      { id: 'r2', date: 'Apr 08', mode: 'TEACH' },
    ],
  },
  '5': {
    id: '5', name: 'Binary Trees', mastery: 25, status: 'weak',
    lastReviewed: 'Apr 10', exposureCount: 5, delta: 4,
    reviewIntervalDays: 3, nextReview: 'Apr 26',
    history: [
      { label: 'Mar 25', mastery: 15 },
      { label: 'Apr 01', mastery: 18 },
      { label: 'Apr 05', mastery: 21 },
      { label: 'Apr 10', mastery: 25 },
    ],
    recentReviews: [
      { id: 'r1', date: 'Apr 10', mode: 'QUIZ', score: 3 },
      { id: 'r2', date: 'Apr 05', mode: 'TEACH' },
    ],
  },
  '6': {
    id: '6', name: 'Dynamic Programming', mastery: 31, status: 'developing',
    lastReviewed: 'Apr 14', exposureCount: 6, delta: 6,
    reviewIntervalDays: 5, nextReview: 'Apr 29',
    history: [
      { label: 'Mar 20', mastery: 18 },
      { label: 'Mar 28', mastery: 22 },
      { label: 'Apr 04', mastery: 26 },
      { label: 'Apr 09', mastery: 28 },
      { label: 'Apr 14', mastery: 31 },
    ],
    recentReviews: [
      { id: 'r1', date: 'Apr 14', mode: 'QUIZ', score: 4 },
      { id: 'r2', date: 'Apr 09', mode: 'TEACH' },
      { id: 'r3', date: 'Apr 04', mode: 'SOCRATIC' },
    ],
  },
}

const statusColors = {
  strong: { bg: 'bg-green-200', text: 'text-green-600' },
  developing: { bg: 'bg-yellow-200', text: 'text-yellow-600' },
  weak: { bg: 'bg-red-200', text: 'text-red-600' },
} as const

const masteryTier = (m: number): Status =>
  m >= 60 ? 'strong' : m >= 40 ? 'developing' : 'weak'

const historyChartConfig = {
  mastery: { label: 'Mastery' },
  strong: { label: 'Strong', color: '#bbf7d0' },
  developing: { label: 'Developing', color: '#fef08a' },
  weak: { label: 'Weak', color: '#fecaca' },
} satisfies ChartConfig

export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const topic = MOCK_TOPICS[id]
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  if (!topic) {
    return (
      <div className="w-full">
        <Link href="/topics" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Topics
        </Link>
        <h1 className="text-4xl font-light mt-4">Topic not found</h1>
        <p className="text-muted-foreground mt-2">No topic with id {id}.</p>
      </div>
    )
  }

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
              topic.delta >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'
            )}
          >
            {topic.delta >= 0 ? '↑' : '↓'} {Math.abs(topic.delta)}% from last week
          </CardDescription>
          <CardContent className="flex flex-col gap-3">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out', colors.bg)}
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
            <CardDescription>Bars colored by tier at each checkpoint</CardDescription>
          </CardHeader>
          <CardContent>
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
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
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
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Recent Activity</CardTitle>
          <CardDescription>Latest sessions touching this topic</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {topic.recentReviews.map((r, i) => (
            <div
              key={r.id}
              className={cn(
                'flex items-center justify-between py-3 text-sm',
                i !== 0 && 'border-t'
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium">{r.mode.charAt(0) + r.mode.slice(1).toLowerCase()}</span>
                <span className="text-xs text-muted-foreground">{r.date}</span>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                {r.score !== undefined ? `${r.score} / 10` : '—'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
