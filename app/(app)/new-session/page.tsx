"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  BookOpenIcon,
  ListChecksIcon,
  MessageCircleQuestionIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGreeting } from "@/lib/greetings";
import { TeachCard } from "@/components/session/teach-card";
import { QuizCard } from "@/components/session/quiz-card";
import { GradeCard } from "@/components/session/grade-card";
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

// ── Message union ─────────────────────────────────────────────────────────────

type UserMsg = { id: string; from: "user"; text: string };
type TeachMsg = { id: string; from: "teach"; data: TeachResponse };
type QuizMsg = { id: string; from: "quiz"; data: QuizResponse };
type SocraticMsg = { id: string; from: "socratic"; data: SocraticResponse };
type ReviewMsg = { id: string; from: "review"; data: ReviewResponse };
type GradeMsg = { id: string; from: "grade"; data: QuizGradeResponse };
type ChatMsg = UserMsg | TeachMsg | QuizMsg | SocraticMsg | ReviewMsg | GradeMsg;

// ── Mode selector config ──────────────────────────────────────────────────────

const MODES = [
  { id: "TEACH", label: "Teach", icon: BookOpenIcon },
  { id: "QUIZ", label: "Quiz", icon: ListChecksIcon },
  { id: "SOCRATIC", label: "Socratic", icon: MessageCircleQuestionIcon },
  { id: "REVIEW", label: "Review", icon: RotateCcwIcon },
] as const;
type Mode = (typeof MODES)[number]["id"];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewSession() {
  const [greeting, setGreeting] = useState("Start a Session");
  const [mode, setMode] = useState<Mode>("TEACH");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [pendingQuiz, setPendingQuiz] = useState<{
    question: string;
    rubric: string;
    hints: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [quizAnswer, setQuizAnswer] = useState("");
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quizRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const uid = () => crypto.randomUUID();

  // ── AI response helpers ───────────────────────────────────────────────────

  const applyAIResponse = (responseMode: string, response: Record<string, unknown>) => {
    if (responseMode === "TEACH") {
      setMessages((m) => [...m, { id: uid(), from: "teach", data: response as unknown as TeachResponse }]);
      setPendingQuiz(null);
    } else if (responseMode === "QUIZ") {
      const quiz = response as unknown as QuizResponse;
      setMessages((m) => [...m, { id: uid(), from: "quiz", data: quiz }]);
      setPendingQuiz({ question: quiz.question, rubric: quiz.rubric, hints: quiz.hints ?? [] });
    } else if (responseMode === "SOCRATIC") {
      setMessages((m) => [...m, { id: uid(), from: "socratic", data: response as unknown as SocraticResponse }]);
      setPendingQuiz(null);
    } else if (responseMode === "REVIEW") {
      setMessages((m) => [...m, { id: uid(), from: "review", data: response as unknown as ReviewResponse }]);
      setPendingQuiz(null);
    }
  };

  // ── Start session (first message) ─────────────────────────────────────────

  const handleStart = async () => {
    const goal = input.trim();
    if (!goal || loading) return;
    setLoading(true);
    setError(null);
    setInput("");
    setMessages([{ id: uid(), from: "user", text: goal }]);

    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start session");
      setSessionState(data.sessionState);
      applyAIResponse(data.mode, data.response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Continue session (text reply for TEACH / SOCRATIC / REVIEW) ───────────

  const handleNext = async () => {
    const text = input.trim();
    if (!text || loading || !sessionState || sessionEnded) return;
    setLoading(true);
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: uid(), from: "user", text }]);

    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionState, userMessage: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSessionState(data.sessionState);
      applyAIResponse(data.mode, data.response);
      if (data.shouldEndSession) setSessionEnded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Submit quiz answer ────────────────────────────────────────────────────

  const handleAnswer = async () => {
    const answer = quizAnswer.trim();
    if (!answer || loading || !sessionState || !pendingQuiz || sessionEnded) return;
    setLoading(true);
    setError(null);
    setQuizAnswer("");
    setMessages((m) => [...m, { id: uid(), from: "user", text: answer }]);

    try {
      const answerRes = await fetch("/api/session/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionState,
          answer,
          question: pendingQuiz.question,
          rubric: pendingQuiz.rubric,
          confidence,
        }),
      });
      const answerData = await answerRes.json();
      if (!answerRes.ok) throw new Error(answerData.error ?? "Failed to submit answer");

      setMessages((m) => [...m, { id: uid(), from: "grade", data: answerData.grade }]);
      setSessionState(answerData.sessionState);
      setPendingQuiz(null);

      if (answerData.shouldEndSession) {
        setSessionEnded(true);
        return;
      }

      // Auto-advance to get the next AI turn after grading
      const nextRes = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionState: answerData.sessionState }),
      });
      const nextData = await nextRes.json();
      if (nextRes.ok) {
        setSessionState(nextData.sessionState);
        applyAIResponse(nextData.mode, nextData.response);
        if (nextData.shouldEndSession) setSessionEnded(true);
      } else {
        setError(nextData.error ?? "Failed to load next question");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Key handlers ──────────────────────────────────────────────────────────

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sessionState ? handleNext() : handleStart();
    }
  };

  const isEmpty = messages.length === 0;
  const isQuizActive = !!pendingQuiz && !sessionEnded;

  return (
    <div className="flex w-full h-[calc(100dvh-5rem)] flex-col overflow-hidden">
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <h1 className="text-4xl font-light">{greeting}</h1>
              <p className="text-muted-foreground mt-2">What do you want to learn about?</p>
            </div>
            <ModeSelector mode={mode} onChange={setMode} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Composer
            inputRef={textareaRef}
            value={input}
            onChange={setInput}
            onKeyDown={onTextKeyDown}
            onSend={handleStart}
            disabled={loading}
            className="w-full max-w-2xl"
          />
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
              {messages.map((m) => (
                <MessageRow key={m.id} msg={m} />
              ))}
              {loading && <TypingDots />}
              {sessionEnded && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Session complete. Start a new one from the sidebar.
                </p>
              )}
              {error && <p className="text-center text-sm text-destructive">{error}</p>}
            </div>
          </div>

          {!sessionEnded && (
            <div className="border-t bg-background">
              <div className="mx-auto w-full max-w-2xl px-4 py-4">
                {isQuizActive ? (
                  <QuizInput
                    quizRef={quizRef}
                    value={quizAnswer}
                    onChange={setQuizAnswer}
                    confidence={confidence}
                    onConfidenceChange={setConfidence}
                    onSubmit={handleAnswer}
                    disabled={loading}
                  />
                ) : (
                  <Composer
                    inputRef={textareaRef}
                    value={input}
                    onChange={setInput}
                    onKeyDown={onTextKeyDown}
                    onSend={handleNext}
                    disabled={loading}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: ChatMsg }) {
  if (msg.from === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground max-w-[80%] whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      {msg.from === "teach" && <TeachCard data={msg.data} />}
      {msg.from === "quiz" && <QuizCard data={msg.data} />}
      {msg.from === "grade" && <GradeCard data={msg.data} />}
      {msg.from === "socratic" && <SocraticCard data={msg.data} />}
      {msg.from === "review" && <ReviewCard data={msg.data} />}
    </div>
  );
}

function ModeSelector({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function Composer({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  className,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring",
        className
      )}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything"
        rows={1}
        className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none max-h-[200px]"
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
  quizRef,
  value,
  onChange,
  confidence,
  onConfidenceChange,
  onSubmit,
  disabled,
}: {
  quizRef: React.RefObject<HTMLTextAreaElement | null>;
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
      <div className="relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <textarea
          ref={quizRef}
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
          className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none max-h-[200px]"
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

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
