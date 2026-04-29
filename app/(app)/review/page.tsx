'use client'

import { useEffect, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NumberTicker } from '@/components/ui/number-ticker'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Topic = {
  id: string
  name: string
  mastery: number
  status: 'strong' | 'developing' | 'weak'
  lastReviewed: string
}

const MOCK_TOPICS: Topic[] = [
  { id: '1', name: 'Pointers in C', mastery: 82, status: 'strong', lastReviewed: 'Apr 22' },
  { id: '2', name: 'Memory Management', mastery: 45, status: 'developing', lastReviewed: 'Apr 20' },
  { id: '3', name: 'Linked Lists', mastery: 71, status: 'strong', lastReviewed: 'Apr 21' },
  { id: '4', name: 'Recursion', mastery: 18, status: 'weak', lastReviewed: 'Apr 12' },
  { id: '5', name: 'Binary Trees', mastery: 25, status: 'weak', lastReviewed: 'Apr 10' },
  { id: '6', name: 'Dynamic Programming', mastery: 31, status: 'developing', lastReviewed: 'Apr 14' },
]

const statusColors = {
  strong: { bg: 'bg-green-200', text: 'text-green-500' },
  developing: { bg: 'bg-yellow-200', text: 'text-yellow-500' },
  weak: { bg: 'bg-red-200', text: 'text-red-500' },
} as const

const REVIEW_THRESHOLD = 40
const MINUTES_PER_REVIEW = 4

function MasteryRing({
  value,
  size = 28,
  strokeWidth = 3,
}: {
  value: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const filled = circumference * (1 - value / 100)
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={filled}
        strokeLinecap="round"
        className="text-red-500"
      />
    </svg>
  )
}

function ReadyToReview({ queue, delta }: { queue: Topic[]; delta: number }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  const total = queue.length
  const tiers = (['weak', 'developing', 'strong'] as const)
    .map((label) => ({
      label,
      count: queue.filter((t) => t.status === label).length,
      color: statusColors[label],
    }))
    .filter((t) => t.count > 0)

  const isGood = delta <= 0

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader className="flex flex-row items-center justify-between w-full">
        <CardTitle className="text-2xl">Ready to Review</CardTitle>
        <NumberTicker value={total} className="text-2xl" />
      </CardHeader>
      <CardDescription
        className={`px-4 ${isGood ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}`}
      >
        {isGood ? '↓' : '↑'} {Math.abs(delta)}% {isGood ? 'fewer' : 'more'} than last week
      </CardDescription>
      <CardContent className="flex flex-col gap-2">
        {tiers.map((tier) => (
          <div
            key={tier.label}
            className="relative flex flex-row items-center w-full justify-between px-4 py-1 rounded-md overflow-hidden"
          >
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out ${tier.color.bg}`}
              style={{ width: animated ? `${(tier.count / total) * 100}%` : '0%' }}
            />
            <p className="relative z-10 text-sm capitalize text-black">{tier.label}</p>
            <NumberTicker
              value={tier.count}
              className={`relative z-10 ${tier.color.text}`}
            />
          </div>
        ))}
      </CardContent>
      <CardFooter className="mt-auto">
        <Button className="w-full">
          Start Review
          <ChevronRightIcon className="ml-1 h-4 w-4" strokeWidth={1.5} />
        </Button>
      </CardFooter>
    </Card>
  )
}

function UpNext({ queue }: { queue: Topic[] }) {
  return (
    <Card className="min-w-0 flex-1">
      <CardHeader className="flex flex-row items-center justify-between w-full pb-4">
        <CardTitle className="text-2xl">Up Next</CardTitle>
        <CardDescription className="text-muted-foreground">
          Weakest first
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {queue.map((topic) => (
          <div key={topic.id} className="flex justify-between items-center text-sm">
            <div className="flex flex-col">
              <span>{topic.name}</span>
              <span className="text-xs text-muted-foreground">
                Last Reviewed: {topic.lastReviewed}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-500">{topic.mastery}%</span>
              <MasteryRing value={topic.mastery} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function ReviewPage() {
  const queue = [...MOCK_TOPICS]
    .filter((t) => t.mastery < REVIEW_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery)
  const estMinutes = queue.length * MINUTES_PER_REVIEW

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row w-full justify-between sm:items-end">
        <h1 className="text-4xl font-light">Review Queue</h1>
        <div className="text-sm text-muted-foreground">
          {queue.length} concepts due · ~{estMinutes} min
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-5 w-full mt-6">
        <ReadyToReview queue={queue} delta={-8} />
        <UpNext queue={queue} />
      </div>
    </div>
  )
}
