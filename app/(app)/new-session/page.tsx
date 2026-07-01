"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  ChevronRightIcon,
  FlagIcon,
  HelpCircleIcon,
  LightbulbIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGreeting } from "@/lib/greetings";
import { TeachCard } from "@/components/session/teach-card";
import { QuizCard } from "@/components/session/quiz-card";
import { SocraticCard } from "@/components/session/socratic-card";
import { ReviewCard } from "@/components/session/review-card";
import type { SessionState } from "@/lib/orchestrator";
import type {
  TeachResponse,
  QuizResponse,
  SocraticResponse,
  ReviewResponse,
  QuizGradeResponse,
} from "@/lib/orchestrator/types";

// ── Concept model (from /api/concepts) ───────────────────────────────────────

type ConceptRow = {
  id: string;
  topic: string;
  parentTopic: string | null;
  mastery: number;
  difficultyTier: string;
  exposureCount: number;
  lastReviewed: string | null;
  reviewInterval: number;
};

function inferMode(c: ConceptRow): "TEACH" | "QUIZ" | "SOCRATIC" | "REVIEW" {
  if (c.exposureCount === 0) return "TEACH";
  if (c.lastReviewed) {
    const days = (Date.now() - new Date(c.lastReviewed).getTime()) / 86_400_000;
    if (days >= (c.reviewInterval ?? 1)) return "REVIEW";
  }
  if (c.mastery < 0.4) return "SOCRATIC";
  return "QUIZ";
}

// ── Block model ───────────────────────────────────────────────────────────────

type SessionBlock = {
  id: string;
  mode: string;
  concept: string;
  difficulty: string;
  response: Record<string, unknown>;
  hints: string[];
  quizMeta?: { question: string; rubric: string };
  userAnswer?: string;
  grade?: QuizGradeResponse;
  masteryBefore?: number;
  masteryAfter?: number;
  status: "active" | "done";
};

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewSession() {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Good morning");
  const [goal, setGoal] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [blocks, setBlocks] = useState<SessionBlock[]>([]);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [quizAnswer, setQuizAnswer] = useState("");
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");
  const [hintsShown, setHintsShown] = useState(0);
  const [showIDontKnowModal, setShowIDontKnowModal] = useState(false);
  const [pendingNextState, setPendingNextState] = useState<SessionState | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const STORAGE_KEY = "cortex:skip-idontknow-warning";

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => setConcepts(d.concepts ?? []))
      .catch(() => {})
      .finally(() => setConceptsLoading(false));
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [blocks, loading]);

  useEffect(() => {
    setHintsShown(0);
  }, [blocks.length]);

  useEffect(() => {
    const flush = () => { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uid = () => crypto.randomUUID();

  const toBlock = (data: {
    mode: string;
    difficulty: string;
    response: Record<string, unknown>;
    sessionState: SessionState;
  }): SessionBlock => {
    const r = data.response as Record<string, unknown>;
    const block: SessionBlock = {
      id: uid(),
      mode: data.mode,
      concept: (data.sessionState.currentConcept as { topic?: string } | null)?.topic ?? "—",
      difficulty: data.difficulty,
      response: data.response,
      hints: Array.isArray(r.hints) ? (r.hints as string[]) : [],
      status: "active",
    };
    if (data.mode === "QUIZ") {
      const q = data.response as unknown as QuizResponse;
      block.quizMeta = { question: q.question, rubric: q.rubric };
    }
    if (data.mode === "REVIEW") {
      const r2 = data.response as unknown as ReviewResponse;
      block.quizMeta = { question: r2.question, rubric: r2.rubric };
    }
    return block;
  };

  // ── Start session ─────────────────────────────────────────────────────────

  const handleStart = async (override?: string) => {
    const goalText = (override ?? input).trim();
    if (!goalText || loading) return;
    setLoading(true);
    setError(null);
    if (!override) setInput("");
    setGoal(goalText);

    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goalText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start session");
      setSessionState(data.sessionState);
      setBlocks([toBlock(data)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setGoal(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Continue (text reply for TEACH / SOCRATIC / REVIEW) ───────────────────

  const handleNext = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading || !sessionState || sessionEnded) return;
    setLoading(true);
    setError(null);
    setInput("");
    setBlocks((bs) => {
      const last = bs[bs.length - 1];
      if (!last) return bs;
      return [...bs.slice(0, -1), { ...last, userAnswer: text, status: "done" as const }];
    });

    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionState, userMessage: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSessionState(data.sessionState);
      setBlocks((bs) => [...bs, toBlock(data)]);
      if (data.shouldEndSession) setSessionEnded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Submit quiz answer ────────────────────────────────────────────────────

  const handleAnswer = async (override?: string) => {
    const answer = (override ?? quizAnswer).trim();
    const activeBlock = blocks[blocks.length - 1];
    if (!answer || loading || !sessionState || !activeBlock?.quizMeta || sessionEnded) return;
    const masteryBefore = sessionState.currentConcept?.mastery;
    setLoading(true);
    setError(null);
    setQuizAnswer("");
    setBlocks((bs) => {
      const last = bs[bs.length - 1];
      if (!last) return bs;
      return [...bs.slice(0, -1), { ...last, userAnswer: answer }];
    });

    try {
      const answerRes = await fetch("/api/session/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionState,
          answer,
          question: activeBlock.quizMeta.question,
          rubric: activeBlock.quizMeta.rubric,
          confidence,
        }),
      });
      const answerData = await answerRes.json();
      if (!answerRes.ok) throw new Error(answerData.error ?? "Failed to submit answer");

      setSessionState(answerData.sessionState);
      setBlocks((bs) => {
        const last = bs[bs.length - 1];
        if (!last) return bs;
        return [
          ...bs.slice(0, -1),
          {
            ...last,
            grade: answerData.grade,
            masteryBefore,
            masteryAfter: (answerData.masteryUpdate as { mastery?: number } | null)?.mastery,
            status: "done" as const,
          },
        ];
      });

      if (answerData.shouldEndSession) {
        setSessionEnded(true);
        return;
      }

      setPendingNextState(answerData.sessionState);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Advance after reviewing grade ─────────────────────────────────────────

  const handleContinue = async () => {
    if (!pendingNextState || loading) return;
    const stateToUse = pendingNextState;
    setPendingNextState(null);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionState: stateToUse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSessionState(data.sessionState);
      setBlocks((bs) => [...bs, toBlock(data)]);
      if (data.shouldEndSession) setSessionEnded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── I don't know ─────────────────────────────────────────────────────────

  const submitIDontKnow = () => {
    const ab = blocks[blocks.length - 1];
    const isGraded =
      !sessionEnded &&
      ab?.status === "active" &&
      (ab?.mode === "QUIZ" || ab?.mode === "REVIEW");
    if (isGraded) {
      handleAnswer("I don't know");
    } else {
      handleNext("I don't know");
    }
  };

  const handleIDontKnow = () => {
    let skip = false;
    try { skip = localStorage.getItem(STORAGE_KEY) === "true"; } catch { /* ignore */ }
    if (skip) {
      submitIDontKnow();
    } else {
      setShowIDontKnowModal(true);
    }
  };

  const onIDontKnowConfirm = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* ignore */ }
    }
    setShowIDontKnowModal(false);
    submitIDontKnow();
  };

  // ── End session ───────────────────────────────────────────────────────────

  const handleEndSession = () => {
    try {
      sessionStorage.setItem(
        "cortex:session-summary",
        JSON.stringify({
          goal,
          blocks: blocks.map((b) => ({
            id: b.id,
            mode: b.mode,
            concept: b.concept,
            difficulty: b.difficulty,
            userAnswer: b.userAnswer,
            grade: b.grade,
            masteryBefore: b.masteryBefore,
            masteryAfter: b.masteryAfter,
          })),
          totalExchanges:
            (sessionState as unknown as { totalExchanges?: number })?.totalExchanges ?? 0,
          conceptsHit:
            (sessionState as unknown as { conceptsHit?: string[] })?.conceptsHit ?? [],
        })
      );
    } catch { /* ignore */ }
    router.push("/session-summary");
  };

  // ── Key handler ───────────────────────────────────────────────────────────

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (sessionState) handleNext(); else handleStart();
    }
  };

  const reviewDueCount = concepts.filter((c) => inferMode(c) === "REVIEW").length;
  const filteredConcepts = search.trim()
    ? concepts.filter((c) =>
        c.topic.toLowerCase().includes(search.toLowerCase()) ||
        (c.parentTopic ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : concepts;

  const activeBlock = blocks[blocks.length - 1];
  const isGradedActive =
    !sessionEnded &&
    activeBlock?.status === "active" &&
    (activeBlock?.mode === "QUIZ" || activeBlock?.mode === "REVIEW");
  const isTextActive =
    !sessionEnded &&
    activeBlock?.status === "active" &&
    activeBlock?.mode !== "QUIZ" &&
    activeBlock?.mode !== "REVIEW";

  return (
    <div className="flex w-full h-[calc(100dvh-5rem)] flex-col overflow-hidden">
      {goal && blocks.length > 0 && !sessionEnded && (
        <button
          type="button"
          onClick={handleEndSession}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-lg transition-all hover:text-foreground hover:shadow-xl"
        >
          <FlagIcon className="h-4 w-4" />
          End Session
        </button>
      )}
      <IDontKnowModal
        key={String(showIDontKnowModal)}
        open={showIDontKnowModal}
        onConfirm={onIDontKnowConfirm}
        onCancel={() => setShowIDontKnowModal(false)}
      />
      {!goal ? (
        // ── Topic picker ───────────────────────────────────────────────────
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-2 py-8 flex flex-col gap-7">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-light">{greeting}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {conceptsLoading
                  ? "Loading your topics…"
                  : concepts.length === 0
                    ? "No topics yet — start with something below"
                    : `${concepts.length} topic${concepts.length !== 1 ? "s" : ""}${reviewDueCount > 0 ? ` · ${reviewDueCount} due for review` : ""}`}
              </p>
            </div>

            {/* Search */}
            {concepts.length > 3 && (
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            {/* Grid */}
            {conceptsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border bg-card h-[148px] animate-pulse"
                  />
                ))}
              </div>
            ) : filteredConcepts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConcepts.map((c) => (
                  <TopicCard
                    key={c.id}
                    concept={c}
                    onClick={() => handleStart(c.topic)}
                    disabled={loading}
                  />
                ))}
              </div>
            ) : search.trim() ? (
              <p className="text-sm text-muted-foreground">
                No topics match &ldquo;{search}&rdquo;
              </p>
            ) : null}

            {/* Custom topic input */}
            <div className="flex flex-col gap-3 border-t pt-6">
              <p className="text-sm text-muted-foreground">
                {concepts.length === 0 ? "Start your first session" : "Or explore something new"}
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Composer
                inputRef={textareaRef}
                value={input}
                onChange={setInput}
                onKeyDown={onTextKeyDown}
                onSend={() => handleStart()}
                disabled={loading}
                placeholder="Describe what you want to learn…"
              />
            </div>
          </div>
        </div>
      ) : (
        // ── Active session ─────────────────────────────────────────────────
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
            {/* Goal + exchange counter */}
            <div className="flex items-center justify-between pb-4 border-b">
              <span className="text-sm font-medium">{goal}</span>
              {sessionState && (
                <span className="text-xs text-muted-foreground">
                  {(sessionState as unknown as { totalExchanges: number }).totalExchanges ?? 0}{" "}
                  exchange
                  {(sessionState as unknown as { totalExchanges: number }).totalExchanges !== 1
                    ? "s"
                    : ""}
                </span>
              )}
            </div>

            {/* Session blocks */}
            {blocks.map((block, i) => {
              const isLast = i === blocks.length - 1;
              return (
                <div key={block.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* Block header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
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

                  {/* AI content — cards handle their own padding */}
                  {block.mode === "TEACH" && (
                    <TeachCard
                      data={block.response as TeachResponse}
                      className="w-full max-w-full rounded-none bg-transparent"
                    />
                  )}
                  {block.mode === "QUIZ" && (
                    <QuizCard
                      data={block.response as QuizResponse}
                      className="w-full max-w-full rounded-none bg-transparent"
                    />
                  )}
                  {block.mode === "SOCRATIC" && (
                    <SocraticCard
                      data={block.response as SocraticResponse}
                      className="w-full max-w-full rounded-none bg-transparent"
                    />
                  )}
                  {block.mode === "REVIEW" && (
                    <ReviewCard
                      data={block.response as ReviewResponse}
                      className="w-full max-w-full rounded-none bg-transparent"
                    />
                  )}

                  {/* User answer (shown after submission) */}
                  {block.userAnswer && (
                    <div className="px-4 py-4 border-t bg-muted/30">
                      <div className="border-l-2 border-primary/40 pl-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Your answer
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {block.userAnswer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Answer result — stays on this block, user continues when ready */}
                  {block.grade && (
                    <AnswerResult
                      grade={block.grade}
                      isLast={isLast}
                      hasPending={!!pendingNextState}
                      onContinue={handleContinue}
                      loading={loading}
                    />
                  )}

                  {/* Inline input for the active block */}
                  {isLast && isTextActive && (
                    <div className="px-4 pb-4 pt-3 border-t flex flex-col gap-2">
                      <Composer
                        inputRef={textareaRef}
                        value={input}
                        onChange={setInput}
                        onKeyDown={onTextKeyDown}
                        onSend={handleNext}
                        disabled={loading}
                        placeholder="Your response…"
                      />
                      <HintControls
                        hints={activeBlock?.hints ?? []}
                        hintsShown={hintsShown}
                        onRevealHint={() => setHintsShown((n) => n + 1)}
                        onIDontKnow={handleIDontKnow}
                      />
                    </div>
                  )}

                  {isLast && isGradedActive && (
                    <div className="px-4 pb-4 pt-3 border-t flex flex-col gap-2">
                      <QuizInput
                        value={quizAnswer}
                        onChange={setQuizAnswer}
                        confidence={confidence}
                        onConfidenceChange={setConfidence}
                        onSubmit={handleAnswer}
                        disabled={loading}
                      />
                      <HintControls
                        hints={activeBlock?.hints ?? []}
                        hintsShown={hintsShown}
                        onRevealHint={() => setHintsShown((n) => n + 1)}
                        onIDontKnow={handleIDontKnow}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && <TypingDots />}
            {sessionEnded && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Session complete. Start a new one from the sidebar.
              </p>
            )}
            {error && <p className="text-center text-sm text-destructive py-2">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Composer({
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

function QuizInput({
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

function AnswerResult({
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

function IDontKnowModal({
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

function HintControls({
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

function TopicCard({
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

function TypingDots() {
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
