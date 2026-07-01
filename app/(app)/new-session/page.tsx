"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { getGreeting } from "@/lib/greetings";
import {
  Composer,
  TopicCard,
  inferMode,
  type ConceptRow,
} from "./_session-ui";

export default function NewSession() {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Good morning");
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // ── Start a session, then redirect to its dedicated page ──────────────────
  const handleStart = async (override?: string, conceptId?: string) => {
    const goalText = (override ?? input).trim();
    if (!goalText || starting) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goalText, conceptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start session");
      const id = data.sessionState?.sessionId;
      if (!id) throw new Error("Session started without an id");
      router.push(`/new-session/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStarting(false);
    }
  };

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const reviewDueCount = concepts.filter((c) => inferMode(c) === "REVIEW").length;
  const filteredConcepts = search.trim()
    ? concepts.filter((c) =>
        c.topic.toLowerCase().includes(search.toLowerCase()) ||
        (c.parentTopic ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : concepts;

  return (
    <div className="flex w-full h-[calc(100dvh-5rem)] flex-col overflow-hidden">
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
                  onClick={() => handleStart(c.topic, c.id)}
                  disabled={starting}
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
              disabled={starting}
              placeholder="Describe what you want to learn…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
