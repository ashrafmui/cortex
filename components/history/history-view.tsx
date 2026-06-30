"use client";

type SessionSummary = {
  id: string;
  goal: string;
  mode: string;
  startedAt: string;
  endedAt: string | null;
  conceptsHit: string[];
};

const MODE_LABEL: Record<string, string> = {
  TEACH: "Teach",
  QUIZ: "Quiz",
  SOCRATIC: "Socratic",
  REVIEW: "Review",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins > 0 ? `${mins}m` : null;
}

export default function HistoryView({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        No sessions yet. Start learning!
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-3">
      <h1 className="text-2xl font-semibold mb-2">Session History</h1>
      {sessions.map((s) => {
        const duration = formatDuration(s.startedAt, s.endedAt);
        return (
          <div
            key={s.id}
            className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-1"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm leading-snug">{s.goal}</p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(s.startedAt)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{MODE_LABEL[s.mode] ?? s.mode}</span>
              {duration && <span>{duration}</span>}
              <span>
                {s.conceptsHit.length} concept
                {s.conceptsHit.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
