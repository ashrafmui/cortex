'use client'

import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { Topic } from '@/lib/data'

const dotColor: Record<Topic['status'], string> = {
  strong: '#4ade80', // green-400
  developing: '#fbbf24', // amber-400
  weak: '#f87171', // red-400
}

// A small, static preview of the knowledge graph that links to the full
// interactive Topic Map. Node colors reflect real mastery; the layout is a
// deterministic scatter (golden-angle) with tree-ish links for a graph feel.
export function TopicMapPreview({ topics }: { topics: Topic[] }) {
  const W = 320
  const H = 130
  const cx = W / 2
  const cy = H / 2

  const pts = topics.slice(0, 10).map((t, i) => {
    const angle = i * 2.399963 // golden angle
    const radius = 8 + i * 6
    return {
      id: t.id,
      color: dotColor[t.status],
      r: 4 + (t.mastery / 100) * 3,
      x: Math.max(12, Math.min(W - 12, cx + Math.cos(angle) * radius * 1.7)),
      y: Math.max(12, Math.min(H - 12, cy + Math.sin(angle) * radius)),
    }
  })

  const edges = pts
    .map((_, i) => (i === 0 ? null : { a: i, b: Math.floor((i - 1) / 2) }))
    .filter((e): e is { a: number; b: number } => e !== null)

  return (
    <Link
      href="/topic-map"
      className="group relative block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <h2 className="text-sm font-semibold">Topic Map</h2>
          <p className="text-xs text-muted-foreground">See how your concepts connect</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          Open
          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      <div className="px-2 pb-2 pt-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full">
          {edges.map((e, i) => (
            <line
              key={i}
              x1={pts[e.a].x}
              y1={pts[e.a].y}
              x2={pts[e.b].x}
              y2={pts[e.b].y}
              className="stroke-foreground"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          ))}
          {pts.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill={p.color} fillOpacity={0.85} />
          ))}
          {pts.length === 0 && (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              className="fill-current text-muted-foreground"
              style={{ fontSize: 11 }}
            >
              No concepts yet
            </text>
          )}
        </svg>
      </div>
    </Link>
  )
}
