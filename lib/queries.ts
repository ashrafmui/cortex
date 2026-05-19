import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Topic } from "@/lib/data";

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatShortDate(d: Date | null | undefined): string {
  if (!d) return "Never";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ConceptForTopic = {
  id: string;
  topic: string;
  mastery: number;
  lastReviewed: Date | null;
  exposureCount?: number;
};

export function toTopic(c: ConceptForTopic): Topic {
  const masteryPct = Math.round(c.mastery * 100);
  const status: Topic["status"] =
    masteryPct >= 70 ? "strong" : masteryPct >= 40 ? "developing" : "weak";
  return {
    id: c.id,
    name: c.topic,
    mastery: masteryPct,
    status,
    lastReviewed: formatShortDate(c.lastReviewed),
    exposureCount: c.exposureCount,
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const dbUser = authUser?.id
    ? await prisma.user.findUnique({ where: { id: authUser.id } })
    : null;

  return { authUser, dbUser };
}

export async function getTopicsForUser(userId: string): Promise<Topic[]> {
  const concepts = await prisma.conceptNode.findMany({
    where: { userId },
    orderBy: { mastery: "desc" },
  });
  return concepts.map(toTopic);
}

export async function getDueForReview(userId: string): Promise<Topic[]> {
  const now = Date.now();
  const concepts = await prisma.conceptNode.findMany({ where: { userId } });
  const due = concepts.filter((c) => {
    if (!c.lastReviewed) return true;
    return c.lastReviewed.getTime() + c.reviewInterval * DAY_MS <= now;
  });
  return due.map(toTopic).sort((a, b) => a.mastery - b.mastery);
}

export async function getStreak(
  userId: string,
): Promise<{ streak: number; lastSevenDays: boolean[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today.getTime() - 6 * DAY_MS);

  const sessions = await prisma.session.findMany({
    where: { userId, startedAt: { gte: sevenDaysAgo } },
    select: { startedAt: true },
  });

  const lastSevenDays: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = today.getTime() - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    lastSevenDays.push(
      sessions.some(
        (s) =>
          s.startedAt.getTime() >= dayStart && s.startedAt.getTime() < dayEnd,
      ),
    );
  }

  let streak = 0;
  for (let i = lastSevenDays.length - 1; i >= 0; i--) {
    if (lastSevenDays[i]) streak++;
    else break;
  }
  return { streak, lastSevenDays };
}

export async function getWeeklyData(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(today.getTime() - 13 * DAY_MS);

  const sessions = await prisma.session.findMany({
    where: { userId, startedAt: { gte: fourteenDaysAgo } },
    select: { startedAt: true, endedAt: true },
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const minutesOf = (s: { startedAt: Date; endedAt: Date | null }) =>
    s.endedAt ? Math.max(0, (s.endedAt.getTime() - s.startedAt.getTime()) / 60000) : 0;

  const weekly: { day: string; minutes: number; sessions: number }[] = [];
  let thisWeekMinutes = 0;
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today.getTime() - i * DAY_MS);
    const dayEndMs = dayStart.getTime() + DAY_MS;
    const inDay = sessions.filter(
      (s) =>
        s.startedAt.getTime() >= dayStart.getTime() &&
        s.startedAt.getTime() < dayEndMs,
    );
    const minutes = inDay.reduce((acc, s) => acc + minutesOf(s), 0);
    thisWeekMinutes += minutes;
    weekly.push({
      day: dayNames[dayStart.getDay()],
      minutes: Math.round(minutes),
      sessions: inDay.length,
    });
  }

  const priorStart = today.getTime() - 13 * DAY_MS;
  const priorEnd = today.getTime() - 6 * DAY_MS;
  const priorWeekMinutes = sessions
    .filter(
      (s) =>
        s.startedAt.getTime() >= priorStart && s.startedAt.getTime() < priorEnd,
    )
    .reduce((acc, s) => acc + minutesOf(s), 0);

  const weeklyDelta =
    priorWeekMinutes === 0
      ? 0
      : Math.round(((thisWeekMinutes - priorWeekMinutes) / priorWeekMinutes) * 1000) / 10;

  return { weekly, weeklyDelta };
}

export async function getMasteryDelta(userId: string): Promise<number> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS);

  const [recent, prior] = await Promise.all([
    prisma.quizResult.findMany({
      where: { concept: { userId }, createdAt: { gte: sevenDaysAgo } },
      select: { score: true },
    }),
    prisma.quizResult.findMany({
      where: {
        concept: { userId },
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      select: { score: true },
    }),
  ]);

  if (recent.length === 0 || prior.length === 0) return 0;
  const avg = (rs: { score: number }[]) =>
    rs.reduce((s, r) => s + r.score, 0) / rs.length;
  return Math.round((avg(recent) - avg(prior)) * 1000) / 10;
}

export async function getMasteryHistoryForConcept(conceptId: string) {
  const results = await prisma.quizResult.findMany({
    where: { conceptId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, score: true },
  });
  return results.map((r) => ({
    label: formatShortDate(r.createdAt),
    mastery: Math.round(r.score * 100),
  }));
}

export async function getRecentReviewsForConcept(
  conceptId: string,
  userId: string,
) {
  const [sessions, quizzes] = await Promise.all([
    prisma.session.findMany({
      where: { userId, conceptsHit: { has: conceptId } },
      orderBy: { startedAt: "desc" },
      take: 6,
      select: { id: true, mode: true, startedAt: true, endedAt: true },
    }),
    prisma.quizResult.findMany({
      where: { conceptId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { createdAt: true, score: true },
    }),
  ]);

  return sessions.map((s) => {
    const sessionEnd = s.endedAt?.getTime() ?? Date.now();
    const qr = quizzes.find(
      (q) =>
        q.createdAt.getTime() >= s.startedAt.getTime() &&
        q.createdAt.getTime() <= sessionEnd,
    );
    return {
      id: s.id,
      date: formatShortDate(s.startedAt),
      mode: s.mode as "TEACH" | "QUIZ" | "SOCRATIC" | "REVIEW",
      score: qr ? Math.round(qr.score * 10) : undefined,
    };
  });
}

export async function getConceptDeltaPct(conceptId: string): Promise<number> {
  const concept = await prisma.conceptNode.findUnique({
    where: { id: conceptId },
    select: { mastery: true },
  });
  if (!concept) return 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const older = await prisma.quizResult.findMany({
    where: { conceptId, createdAt: { lt: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { score: true },
  });
  if (older.length === 0) return 0;

  const olderAvg = older.reduce((s, r) => s + r.score, 0) / older.length;
  return Math.round((concept.mastery - olderAvg) * 100);
}
