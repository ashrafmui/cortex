"use client";

import { cn } from "@/lib/utils";

type ConceptSummary = {
  id: string;
  topic: string;
  mastery: number;
  difficultyTier: string;
};

type TopicGroup = {
  name: string;
  nodes: ConceptSummary[];
};

function masteryColor(mastery: number) {
  if (mastery >= 0.7)
    return "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300";
  if (mastery >= 0.4)
    return "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300";
  return "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300";
}

export default function TopicMapView({ groups }: { groups: TopicGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        No concepts yet. Start a learning session to build your knowledge graph.
      </div>
    );
  }

  const total = groups.reduce((acc, g) => acc + g.nodes.length, 0);
  const avgMastery =
    total > 0
      ? groups.flatMap((g) => g.nodes).reduce((acc, n) => acc + n.mastery, 0) / total
      : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Topic Map</h1>
        <span className="text-sm text-muted-foreground">
          {total} concept{total !== 1 ? "s" : ""} · {Math.round(avgMastery * 100)}% avg mastery
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Legend color="bg-green-300" label="Strong (≥70%)" />
        <Legend color="bg-amber-300" label="Developing (40–69%)" />
        <Legend color="bg-red-300" label="Weak (<40%)" />
      </div>

      {groups.map((g) => (
        <div key={g.name} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {g.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            {g.nodes.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium flex items-center gap-1.5",
                  masteryColor(n.mastery)
                )}
              >
                <span>{n.topic}</span>
                <span className="tabular-nums opacity-60">{Math.round(n.mastery * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}
