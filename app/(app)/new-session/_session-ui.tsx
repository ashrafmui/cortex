"use client";

// Shared building blocks for the topic picker (page.tsx) and the active
// session view ([sessionId]/page.tsx): mode constants, the concept-mode
// heuristic, block helpers, and the presentational sub-components.

import { useEffect, useState } from "react";
import {
  ArrowUpIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  LightbulbIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionState } from "@/lib/orchestrator";
import type { QuizGradeResponse, QuizResponse, ReviewResponse } from "@/lib/orchestrator/types";
import type { SessionBlock } from "@/lib/session/rehydrate";

export type { SessionBlock } from "@/lib/session/rehydrate";

export const STORAGE_KEY = "cortex:skip-idontknow-warning";

// ── Concept model (from /api/concepts) ───────────────────────────────────────

export type ConceptRow = {
  id: string;
  topic: string;
  parentTopic: string | null;
  mastery: number;
  difficultyTier: string;
  exposureCount: number;
  lastReviewed: string | null;
  reviewInterval: number;
};

// Mirror of sm2.ts decayMastery — keeps the card badge in sync with the mode
// the orchestrator will actually pick (which decays overdue mastery).
const MASTERY_DECAY_RATE = 0.05;
function decayedMastery(c: ConceptRow): number {
  if (!c.lastReviewed || c.reviewInterval <= 0) return c.mastery;
  const days = (Date.now() - new Date(c.lastReviewed).getTime()) / 86_400_000;
  const overdue = days - c.reviewInterval;
  if (overdue <= 0) return c.mastery;
  return Math.max(0, c.mastery - MASTERY_DECAY_RATE * (overdue / c.reviewInterval));
}

// Mirror of sm2.ts isDueForReview.
function isDue(c: ConceptRow): boolean {
  if (!c.lastReviewed) return c.exposureCount > 0;
  const days = (Date.now() - new Date(c.lastReviewed).getTime()) / 86_400_000;
  return days >= c.reviewInterval;
}

// Mirror of selectMode() server-side so the badge matches the session that starts.
export function inferMode(c: ConceptRow): "TEACH" | "QUIZ" | "SOCRATIC" | "REVIEW" {
  if (c.exposureCount === 0) return "TEACH";
  if (decayedMastery(c) < 0.4) return "SOCRATIC"; // struggling beats review
  if (isDue(c)) return "REVIEW";
  return "QUIZ";
}

export const MODE_LABELS: Record<string, string> = {
  TEACH: "Teaching",
  QUIZ: "Quiz",
  SOCRATIC: "Socratic",
  REVIEW: "Review",
};

export const MODE_COLORS: Record<string, string> = {
  TEACH: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  QUIZ: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  SOCRATIC: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  REVIEW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

// ── Block helper ──────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

/** Build a fresh block from an API response (session start / next). */
export function toBlock(data: {
  mode: string;
  difficulty: string;
  response: Record<string, unknown>;
  sessionState: SessionState;
}): SessionBlock {
  const r = data.response;
  const block: SessionBlock = {
    id: uid(),
    mode: data.mode,
    concept: (data.sessionState.currentConcept as { topic?: string } | null)?.topic ?? "—",
    difficulty: data.difficulty,
    response: data.response,
    hints: Array.isArray(r.hints) ? (r.hints as string[]) : [],
    status: "active",
  };
  if (data.mode === "SOCRATIC") {
    block.socraticTurns = [];
  }
  if (data.mode === "QUIZ") {
    const q = data.response as unknown as QuizResponse;
    block.quizMeta = { question: q.question, rubric: q.rubric };
  }
  if (data.mode === "REVIEW") {
    const r2 = data.response as unknown as ReviewResponse;
    block.quizMeta = { question: r2.question, rubric: r2.rubric };
  }
  return block;
}

// ── Sub-components ────────────────────────────────────────────────────────────

export function Composer({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  placeholder = "Your response…",
  className,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring",
        className
      )}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className="w-full resize-none rounded-xl bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none max-h-[200px]"
      />
      <Button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        size="icon"
        className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
      >
        <ArrowUpIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function QuizInput({
  value,
  onChange,
  confidence,
  onConfidenceChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  confidence: "low" | "medium" | "high";
  onConfidenceChange: (c: "low" | "medium" | "high") => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Confidence:</span>
        {(["low", "medium", "high"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onConfidenceChange(c)}
            className={cn(
              "rounded-full border px-2 py-0.5 capitalize transition-colors",
              confidence === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="relative rounded-xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Write your answer…"
          rows={3}
          className="w-full resize-none rounded-xl bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none max-h-[200px]"
        />
        <Button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AnswerResult({
  grade,
  isLast,
  hasPending,
  onContinue,
  loading,
}: {
  grade: QuizGradeResponse;
  isLast: boolean;
  hasPending: boolean;
  onContinue: () => void;
  loading: boolean;
}) {
  const pct = Math.round(grade.score * 100);

  const tier =
    grade.score >= 0.8
      ? { label: "Correct", bar: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" }
      : grade.score >= 0.6
        ? { label: "Good", bar: "bg-blue-500", text: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" }
        : grade.score >= 0.4
          ? { label: "Partial", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" }
          : { label: "No match", bar: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" };

  return (
    <div className="border-t">
      {/* Score band */}
      <div className={cn("px-4 py-4", tier.bg)}>
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-sm font-semibold", tier.text)}>{tier.label}</span>
          <span className={cn("text-sm tabular-nums font-medium", tier.text)}>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full", tier.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{grade.reasoning}</p>
      </div>

      {/* Correct answer */}
      <div className="px-4 py-3 border-t">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Correct answer</p>
        <p className="text-sm leading-relaxed">{grade.correct_answer}</p>
      </div>

      {/* Continue */}
      {isLast && hasPending && (
        <div className="px-4 pb-4 pt-2 flex justify-end border-t">
          <Button size="sm" onClick={onContinue} disabled={loading}>
            Continue
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function IDontKnowModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="text-base font-semibold">Reveal the answer?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This will show you the correct answer. Your mastery of this concept
          will decrease as a result — it&apos;s better to attempt an answer,
          even if you&apos;re unsure.
        </p>

        <label className="mt-5 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm text-muted-foreground">
            Don&apos;t show this warning again
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(dontShowAgain)}>
            Reveal answer
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HintControls({
  hints,
  hintsShown,
  onRevealHint,
  onIDontKnow,
}: {
  hints: string[];
  hintsShown: number;
  onRevealHint: () => void;
  onIDontKnow: () => void;
}) {
  const hasMore = hintsShown < hints.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onIDontKnow}
          className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
        >
          <HelpCircleIcon className="h-3.5 w-3.5" />
          I don&apos;t know
        </button>
        {hints.length > 0 && (
          <button
            type="button"
            onClick={onRevealHint}
            disabled={!hasMore}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              hasMore
                ? "border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                : "border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
            )}
          >
            <LightbulbIcon className="h-3.5 w-3.5" />
            {hintsShown === 0 ? "Give a hint" : hasMore ? "Another hint" : "No more hints"}
          </button>
        )}
      </div>

      {hintsShown > 0 && (
        <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground px-0.5">
          {hintsShown} of {hints.length} hint{hints.length !== 1 ? "s" : ""} shown
        </p>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
          <ul className="space-y-2">
            {hints.slice(0, hintsShown).map((h, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-blue-700 dark:text-blue-300">
                <LightbulbIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" />
                {h}
              </li>
            ))}
          </ul>
        </div>
        </div>
      )}
    </div>
  );
}

export function TopicCard({
  concept,
  onClick,
  disabled,
}: {
  concept: ConceptRow;
  onClick: () => void;
  disabled: boolean;
}) {
  const [animated, setAnimated] = useState(false);
  const mode = inferMode(concept);
  const isNew = concept.exposureCount === 0;
  const pct = Math.round(concept.mastery * 100);

  const fillColor =
    isNew
      ? ""
      : concept.mastery >= 0.7
        ? "bg-green-200 dark:bg-green-900/50"
        : concept.mastery >= 0.4
          ? "bg-yellow-200 dark:bg-yellow-900/50"
          : "bg-red-200 dark:bg-red-900/50";

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative overflow-hidden rounded-xl border bg-card text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Animated mastery fill (left-to-right, like the topics list) */}
      {!isNew && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out",
            fillColor
          )}
          style={{ width: animated ? `${pct}%` : "0%" }}
        />
      )}

      <div className="relative z-10 flex flex-col gap-3 p-4 h-full">
        {/* Top row: mode badge + due pill */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              MODE_COLORS[mode] ?? "bg-muted text-muted-foreground"
            )}
          >
            {isNew ? "New" : MODE_LABELS[mode]}
          </span>
          {mode === "REVIEW" && !isNew && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Due
            </span>
          )}
        </div>

        {/* Topic + parent */}
        <div className="flex flex-col gap-0.5 flex-1">
          <p className="text-sm font-semibold leading-snug line-clamp-2">{concept.topic}</p>
          {concept.parentTopic && (
            <p className="text-xs text-muted-foreground">{concept.parentTopic}</p>
          )}
        </div>

        {/* Bottom: mastery or "Never studied" */}
        <div className="flex items-center justify-between pt-1">
          {isNew ? (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Never studied
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{pct}% mastery</p>
          )}
          <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  );
}

export function TypingDots() {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
