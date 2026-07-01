"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
} from "@/lib/orchestrator/types";
import {
  AnswerResult,
  Composer,
  HintControls,
  IDontKnowModal,
  MODE_COLORS,
  MODE_LABELS,
  QuizInput,
  STORAGE_KEY,
  TypingDots,
  toBlock,
  type SessionBlock,
} from "../_session-ui";

export default function SessionPage() {
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [goal, setGoal] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<SessionBlock[]>([]);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // ── Load / rehydrate the session from the server ──────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    let ignore = false;
    setInitialLoading(true);
    fetch(`/api/session/${sessionId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load session");
        return data;
      })
      .then((data) => {
        if (ignore) return;
        setGoal(data.goal);
        setBlocks(data.blocks ?? []);
        setSessionState(data.sessionState);
        setSessionEnded(!!data.sessionEnded);
      })
      .catch((e) => {
        if (!ignore) setLoadError(e instanceof Error ? e.message : "Failed to load session");
      })
      .finally(() => {
        if (!ignore) setInitialLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [sessionId]);

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
  }, []);

  // ── Continue (text reply for TEACH) ───────────────────────────────────────

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

  // ── Socratic reply (loops within a block until understanding) ─────────────

  const handleSocraticReply = async (override?: string) => {
    const text = (override ?? input).trim();
    const active = blocks[blocks.length - 1];
    if (!text || loading || !sessionState || sessionEnded || active?.mode !== "SOCRATIC") return;
    const currentQuestion = (active.response as unknown as SocraticResponse).question;

    setLoading(true);
    setError(null);
    setInput("");

    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionState, userMessage: text, question: currentQuestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSessionState(data.sessionState);

      if (data.continueSocratic) {
        // Same block: bank the answered turn, swap in the follow-up question.
        setHintsShown(0); // new question in the same block → reset revealed hints
        setBlocks((bs) => {
          const last = bs[bs.length - 1];
          if (!last) return bs;
          return [
            ...bs.slice(0, -1),
            {
              ...last,
              socraticTurns: [
                ...(last.socraticTurns ?? []),
                { question: currentQuestion, userAnswer: text },
              ],
              response: data.response,
              hints: Array.isArray(data.response?.hints) ? data.response.hints : [],
            },
          ];
        });
      } else {
        // Concluded: close this block (final turn banked) and append the next.
        setBlocks((bs) => {
          const last = bs[bs.length - 1];
          if (!last) return bs;
          const closed: SessionBlock = {
            ...last,
            socraticTurns: [
              ...(last.socraticTurns ?? []),
              data.concludedTurn ?? { question: currentQuestion, userAnswer: text },
            ],
            status: "done" as const,
          };
          return [...bs.slice(0, -1), closed, toBlock(data)];
        });
        if (data.shouldEndSession) setSessionEnded(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Route a text submission to the right handler based on the active block's mode.
  const handleTextSubmit = (override?: string) => {
    const active = blocks[blocks.length - 1];
    if (active?.mode === "SOCRATIC") return handleSocraticReply(override);
    return handleNext(override);
  };

  // ── Submit quiz / review answer ───────────────────────────────────────────

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

  // ── Advance after reviewing a grade (works for live + rehydrated) ─────────

  const handleContinue = async () => {
    const stateToUse = pendingNextState ?? sessionState;
    if (!stateToUse || loading || sessionEnded) return;
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
      handleTextSubmit("I don't know");
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
      handleTextSubmit();
    }
  };

  // ── Derived render flags ──────────────────────────────────────────────────

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

  // ── Loading / error gates ─────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="flex w-full h-[calc(100dvh-5rem)] items-center justify-center">
        <TypingDots />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex w-full h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <button
          type="button"
          onClick={() => router.push("/new-session")}
          className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to New Session
        </button>
      </div>
    );
  }

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
                    data={block.response as unknown as TeachResponse}
                    className="w-full max-w-full rounded-none bg-transparent"
                  />
                )}
                {block.mode === "QUIZ" && (
                  <QuizCard
                    data={block.response as unknown as QuizResponse}
                    className="w-full max-w-full rounded-none bg-transparent"
                  />
                )}
                {block.mode === "SOCRATIC" && (
                  <div className="flex flex-col">
                    {(block.socraticTurns ?? []).map((t, ti) => (
                      <div key={ti} className="flex flex-col">
                        <div className="px-4 py-3 text-sm leading-relaxed italic">
                          {t.question}
                        </div>
                        <div className="px-4 py-4 border-t bg-muted/30">
                          <div className="border-l-2 border-primary/40 pl-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              Your answer
                            </p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {t.userAnswer}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {block.status === "active" && (
                      <div className={cn((block.socraticTurns ?? []).length > 0 && "border-t")}>
                        <SocraticCard
                          data={block.response as unknown as SocraticResponse}
                          className="w-full max-w-full rounded-none bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                )}
                {block.mode === "REVIEW" && (
                  <ReviewCard
                    data={block.response as unknown as ReviewResponse}
                    className="w-full max-w-full rounded-none bg-transparent"
                  />
                )}

                {/* User answer (shown after submission; Socratic tracks its own turns) */}
                {block.userAnswer && block.mode !== "SOCRATIC" && (
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
                    hasPending={!sessionEnded}
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
                      onSend={handleTextSubmit}
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
    </div>
  );
}
