import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TODAY = new Date("2026-05-18T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(TODAY.getTime() - n * DAY_MS);

async function main() {
  const targetEmail = process.env.SEED_USER_EMAIL ?? "test@cortex.dev";
  const explicitId = process.env.SEED_USER_ID;

  let user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    if (!explicitId) {
      console.warn(
        `Skipping seed: no Prisma User found for ${targetEmail}.\n` +
          `  1. Sign up at /auth/sign-up with that email first (creates the Prisma User automatically), then re-run seed.\n` +
          `  2. Or set SEED_USER_ID in .env.local to a Supabase auth user UUID and re-run.`,
      );
      return;
    }
    user = await prisma.user.create({
      data: { id: explicitId, email: targetEmail, name: "Test User", createdAt: daysAgo(30) },
    });
  }

  // Scope wipe to this user only — preserves other users' data.
  await prisma.quizResult.deleteMany({ where: { concept: { userId: user.id } } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.conceptNode.deleteMany({ where: { userId: user.id } });

  const concepts = await Promise.all(
    [
      {
        topic: "Pointers in C",
        parentTopic: "Memory Management",
        mastery: 0.82,
        difficultyTier: "deep",
        lastReviewed: daysAgo(2),
        reviewInterval: 6,
        easeFactor: 2.6,
        exposureCount: 9,
      },
      {
        topic: "Memory Management",
        parentTopic: null,
        mastery: 0.45,
        difficultyTier: "working",
        lastReviewed: daysAgo(28),
        reviewInterval: 4,
        easeFactor: 2.3,
        exposureCount: 5,
      },
      {
        topic: "Linked Lists",
        parentTopic: "Data Structures",
        mastery: 0.71,
        difficultyTier: "working",
        lastReviewed: daysAgo(3),
        reviewInterval: 5,
        easeFactor: 2.5,
        exposureCount: 7,
      },
      {
        topic: "Recursion",
        parentTopic: null,
        mastery: 0.18,
        difficultyTier: "foundation",
        lastReviewed: daysAgo(35),
        reviewInterval: 1,
        easeFactor: 2.0,
        exposureCount: 3,
      },
      {
        topic: "Binary Trees",
        parentTopic: "Data Structures",
        mastery: 0.25,
        difficultyTier: "foundation",
        lastReviewed: daysAgo(38),
        reviewInterval: 2,
        easeFactor: 2.1,
        exposureCount: 2,
      },
      {
        topic: "Dynamic Programming",
        parentTopic: null,
        mastery: 0.31,
        difficultyTier: "foundation",
        lastReviewed: daysAgo(34),
        reviewInterval: 2,
        easeFactor: 2.2,
        exposureCount: 4,
      },
      {
        topic: "Stack & Heap",
        parentTopic: "Memory Management",
        mastery: 0.55,
        difficultyTier: "working",
        lastReviewed: daysAgo(6),
        reviewInterval: 7,
        easeFactor: 2.4,
        exposureCount: 4,
      },
      {
        topic: "Tree Traversal",
        parentTopic: "Binary Trees",
        mastery: 0.40,
        difficultyTier: "foundation",
        lastReviewed: daysAgo(12),
        reviewInterval: 3,
        easeFactor: 2.2,
        exposureCount: 3,
      },
    ].map((data, i) =>
      prisma.conceptNode.create({
        data: {
          ...data,
          userId: user.id,
          createdAt: daysAgo(30 - i * 2),
        },
      }),
    ),
  );

  const byTopic = Object.fromEntries(concepts.map((c) => [c.topic, c]));

  await prisma.session.createMany({
    data: [
      {
        userId: user.id,
        goal: "Tighten up pointer arithmetic edge cases",
        mode: "QUIZ",
        messages: [
          { role: "system", content: "Quiz on pointer arithmetic", mode: "QUIZ", timestamp: daysAgo(1).toISOString() },
          { role: "assistant", content: "Given `int *p = arr + 2;`, what does `*(p - 1)` evaluate to?", mode: "QUIZ", timestamp: daysAgo(1).toISOString() },
          { role: "user", content: "arr[1]", mode: "QUIZ", timestamp: daysAgo(1).toISOString() },
          { role: "assistant", content: "Correct — pointer arithmetic scales by element size.", mode: "QUIZ", timestamp: daysAgo(1).toISOString() },
        ],
        conceptsHit: [byTopic["Pointers in C"].id],
        startedAt: daysAgo(1),
        endedAt: new Date(daysAgo(1).getTime() + 12 * 60 * 1000),
      },
      {
        userId: user.id,
        goal: "Refresh memory management fundamentals",
        mode: "REVIEW",
        messages: [
          { role: "system", content: "Review session", mode: "REVIEW", timestamp: daysAgo(2).toISOString() },
          { role: "assistant", content: "Walk me through the lifecycle of a `malloc`-ed pointer.", mode: "SOCRATIC", timestamp: daysAgo(2).toISOString() },
        ],
        conceptsHit: [byTopic["Memory Management"].id, byTopic["Stack & Heap"].id],
        startedAt: daysAgo(2),
        endedAt: new Date(daysAgo(2).getTime() + 8 * 60 * 1000),
      },
      {
        userId: user.id,
        goal: "Introduction to linked list traversal",
        mode: "TEACH",
        messages: [
          { role: "system", content: "Teach linked list traversal", mode: "TEACH", timestamp: daysAgo(3).toISOString() },
          { role: "assistant", content: "A linked list is a chain of nodes. Each node holds data and a pointer to the next.", mode: "TEACH", timestamp: daysAgo(3).toISOString() },
        ],
        conceptsHit: [byTopic["Linked Lists"].id],
        startedAt: daysAgo(3),
        endedAt: new Date(daysAgo(3).getTime() + 14 * 60 * 1000),
      },
      {
        userId: user.id,
        goal: "Practice recursive thinking",
        mode: "SOCRATIC",
        messages: [
          { role: "system", content: "Socratic recursion", mode: "SOCRATIC", timestamp: daysAgo(5).toISOString() },
          { role: "assistant", content: "What is the smallest input where the problem is trivially solved?", mode: "SOCRATIC", timestamp: daysAgo(5).toISOString() },
        ],
        conceptsHit: [byTopic["Recursion"].id],
        startedAt: daysAgo(5),
        endedAt: new Date(daysAgo(5).getTime() + 18 * 60 * 1000),
      },
    ],
  });

  await prisma.quizResult.createMany({
    data: [
      {
        conceptId: byTopic["Pointers in C"].id,
        score: 0.9,
        confidence: "high",
        question: "What does `*(p + 2)` evaluate to if `p` points to the start of an int array?",
        answer: "The third element of the array.",
        feedback: "Correct — pointer arithmetic accounts for element size.",
        createdAt: daysAgo(1),
      },
      {
        conceptId: byTopic["Pointers in C"].id,
        score: 0.75,
        confidence: "medium",
        question: "What is a dangling pointer?",
        answer: "A pointer to freed memory.",
        feedback: "Right — and dereferencing it is undefined behavior.",
        createdAt: daysAgo(8),
      },
      {
        conceptId: byTopic["Recursion"].id,
        score: 0.3,
        confidence: "low",
        question: "Identify the base case in this factorial implementation.",
        answer: "The recursive call.",
        feedback: "Not quite — the base case is the condition that stops recursion.",
        createdAt: daysAgo(5),
      },
      {
        conceptId: byTopic["Binary Trees"].id,
        score: 0.4,
        confidence: "medium",
        question: "What is the height of a balanced binary tree with N nodes?",
        answer: "N/2",
        feedback: "Closer to log2(N) — balanced trees grow logarithmically.",
        createdAt: daysAgo(7),
      },
      {
        conceptId: byTopic["Memory Management"].id,
        score: 0.6,
        confidence: "medium",
        question: "Which region holds dynamically allocated memory?",
        answer: "The heap.",
        feedback: "Correct.",
        createdAt: daysAgo(2),
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    concepts: await prisma.conceptNode.count(),
    sessions: await prisma.session.count(),
    quizResults: await prisma.quizResult.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
