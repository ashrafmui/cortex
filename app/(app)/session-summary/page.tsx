"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronRightIcon,
  FlagIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizGradeResponse } from "@/lib/orchestrator/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type SummaryBlock = {
  id: string;
  mode: string;
  concept: string;
  difficulty: string;
  userAnswer?: string;
  grade?: QuizGradeResponse;
  masteryBefore?: number;
  masteryAfter?: number;
};

type SessionSummaryData = {
  goal: string;
  blocks: SummaryBlock[];
  totalExchanges: number;
  conceptsHit: string[];
};

type ConceptRow = {
  id: string;
  topic: string;
  parentTopic: string | null;
  mastery: number;
  difficultyTier: string;
  exposureCount: number;
  lastReviewed: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  TEACH: "Teaching",
  QUIZ: "Quiz",
  SOCRATIC: "Socratic",
  REVIEW: "Review",
};

const MODE_COLORS: Record<string, string> = {
  TEACH: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  QUIZ: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  SOCRATIC: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  REVIEW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function masteryColor(m: number) {
  if (m >= 0.7) return "bg-green-500";
  if (m >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

function masteryLabel(m: number) {
  if (m >= 0.7) return "text-green-700 dark:text-green-400";
  if (m >= 0.4) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function scoreTier(score: number) {
  if (score >= 0.8) return { label: "Correct", bar: "bg-green-500", text: "text-green-700 dark:text-green-400" };
  if (score >= 0.6) return { label: "Good", bar: "bg-blue-500", text: "text-blue-700 dark:text-blue-400" };
  if (score >= 0.4) return { label: "Partial", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
  return { label: "No match", bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionSummaryPage() {
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cortex:session-summary");
      if (raw) setSummary(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => setConcepts(d.concepts ?? []))
      .catch(() => {})
      .finally(() => setConceptsLoading(false));
  }, []);

  if (!summary) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">No session data found.</p>
        <Button asChild>
          <Link href="/new-session">Start a session</Link>
        </Button>
      </div>
    );
  }

  const gradedBlocks = summary.blocks.filter((b) => b.grade);
  const avgScore =
    gradedBlocks.length > 0
      ? gradedBlocks.reduce((sum, b) => sum + (b.grade?.score ?? 0), 0) / gradedBlocks.length
      : null;
  const uniqueConcepts = [...new Set(summary.blocks.map((b) => b.concept))];

  // Concepts touched this session, from the API response
  const sessionConceptRows = concepts.filter((c) =>
    uniqueConcepts.some((name) => c.topic === name)
  );

  // All other concepts (for the overall section)
  const otherConceptRows = concepts.filter(
    (c) => !uniqueConcepts.some((name) => c.topic === name)
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 flex flex-col gap-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <FlagIcon className="h-4.5 w-4.5 text-primary" />
          </span>
          <h1 className="text-2xl font-semibold">Session Complete</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1 ml-[52px]">{summary.goal}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={uniqueConcepts.length} label="Concepts" />
        <StatCard value={summary.totalExchanges} label="Exchanges" />
        <StatCard
          value={avgScore !== null ? `${Math.round(avgScore * 100)}%` : "—"}
          label="Avg score"
        />
      </div>

      {/* Session blocks */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <BookOpenIcon className="h-4 w-4" />
          What you covered
        </h2>
        {summary.blocks.map((block) => (
          <BlockSummaryCard key={block.id} block={block} />
        ))}
      </section>

      {/* Current mastery for session concepts */}
      {sessionConceptRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <TrendingUpIcon className="h-4 w-4" />
            Your mastery — this session&apos;s concepts
          </h2>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {sessionConceptRows.map((c) => {
              const sessionBlock = summary.blocks.find((b) => b.concept === c.topic && b.grade);
              return (
                <MasteryRow
                  key={c.id}
                  concept={c}
                  masteryBefore={sessionBlock?.masteryBefore}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Overall progress snapshot */}
      {!conceptsLoading && otherConceptRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            Overall progress
          </h2>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {otherConceptRows.slice(0, 5).map((c) => (
              <MasteryRow key={c.id} concept={c} />
            ))}
          </div>
          {otherConceptRows.length > 5 && (
            <Link
              href="/topics"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              View all {concepts.length} topics
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          )}
        </section>
      )}

      {/* CTAs */}
      <div className="flex gap-3 pt-2">
        <Button asChild>
          <Link href="/new-session">Start New Session</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/topics">View Topics</Link>
        </Button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-4 flex flex-col gap-0.5">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function BlockSummaryCard({ block }: { block: SummaryBlock }) {
  const grade = block.grade;
  const tier = grade ? scoreTier(grade.score) : null;
  const pct = grade ? Math.round(grade.score * 100) : null;
  const delta =
    block.masteryBefore !== undefined && block.masteryAfter !== undefined
      ? block.masteryAfter - block.masteryBefore
      : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            MODE_COLORS[block.mode] ?? "bg-muted text-muted-foreground"
          )}
        >
          {MODE_LABELS[block.mode] ?? block.mode}
        </span>
        <span className="text-xs text-muted-foreground">{block.concept}</span>
        <span className="ml-auto text-xs text-muted-foreground/60 capitalize">
          {block.difficulty}
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {block.userAnswer ? (
          <p className="text-sm text-muted-foreground line-clamp-2 italic">
            &ldquo;{block.userAnswer}&rdquo;
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No answer submitted</p>
        )}

        {grade && tier && pct !== null && (
          <div className="flex items-center gap-3 pt-1">
            {/* Score bar */}
            <div className="flex-1 h-1.5 rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", tier.bar)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cn("text-xs font-medium tabular-nums shrink-0", tier.text)}>
              {tier.label} · {pct}%
            </span>

            {/* Mastery delta */}
            {delta !== null && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums shrink-0",
                  delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {delta >= 0 ? "+" : ""}
                {Math.round(delta * 100)}% mastery
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MasteryRow({
  concept,
  masteryBefore,
}: {
  concept: ConceptRow;
  masteryBefore?: number;
}) {
  const pct = Math.round(concept.mastery * 100);
  const beforePct = masteryBefore !== undefined ? Math.round(masteryBefore * 100) : null;
  const gained = beforePct !== null ? pct - beforePct : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium truncate">{concept.topic}</span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {gained !== null && gained !== 0 && (
              <span
                className={cn(
                  "text-xs font-medium",
                  gained > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {gained > 0 ? "+" : ""}
                {gained}%
              </span>
            )}
            <span className={cn("text-xs font-semibold tabular-nums", masteryLabel(concept.mastery))}>
              {pct}%
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          {beforePct !== null && (
            <div
              className="h-full rounded-full bg-muted-foreground/20 absolute"
              style={{ width: `${beforePct}%` }}
            />
          )}
          <div
            className={cn("h-full rounded-full transition-all", masteryColor(concept.mastery))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
