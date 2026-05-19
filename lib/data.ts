import { ChartConfig } from "@/components/ui/chart"; // adjust import path

export type Topic = {
  id: string;
  name: string;
  mastery: number;
  status: "strong" | "developing" | "weak";
  lastReviewed: string;
  exposureCount?: number;
};

export const statusColors = {
  strong: { bg: "bg-green-200", text: "text-green-500" },
  developing: { bg: "bg-yellow-200", text: "text-yellow-500" },
  weak: { bg: "bg-red-200", text: "text-red-500" },
} as const;

export const weeklyChartConfig = {
  minutes: { label: "Minutes" },
  strong: { label: "Strong", color: "#bbf7d0" },
  developing: { label: "Developing", color: "#fef08a" },
  weak: { label: "Weak", color: "#fecaca" },
} satisfies ChartConfig;

export const minutesTier = (minutes: number): "strong" | "developing" | "weak" =>
  minutes >= 40 ? "strong" : minutes >= 20 ? "developing" : "weak";

export const MOCK = {
  name: "Muhaiminul",
  streak: 5,
  lastSevenDays: [true, true, false, true, true, true, false],
  totalConcepts: 23,
  overallMastery: 64,
  masteryDelta: 3.2,
  dueForReview: 4,
  topics: [
  { id: "1", name: "Pointers in C", mastery: 82, status: "strong", lastReviewed: "Apr 22" },
  { id: "2", name: "Memory Management", mastery: 45, status: "developing", lastReviewed: "Apr 20" },
  { id: "3", name: "Linked Lists", mastery: 71, status: "strong", lastReviewed: "Apr 21" },
  { id: "4", name: "Recursion", mastery: 18, status: "weak", lastReviewed: "Apr 12" },
  { id: "5", name: "Binary Trees", mastery: 25, status: "weak", lastReviewed: "Apr 10" },
  { id: "6", name: "Dynamic Programming", mastery: 31, status: "developing", lastReviewed: "Apr 14" },
  
] as Topic[],
  recentSessions: [
    { id: "1", topicId: "1", date: "Apr 17", duration: "12 min", delta: +0.15 },
    { id: "2", topicId: "2", date: "Apr 16", duration: "8 min", delta: +0.22 },
    { id: "3", topicId: "3", date: "Apr 15", duration: "14 min", delta: +0.09 },
  ],
  weakConcepts: [
    { id: "1", topic: "Recursion", mastery: 18 },
    { id: "2", topic: "Binary Trees", mastery: 25 },
    { id: "3", topic: "Dynamic Programming", mastery: 31 },
  ],
  distribution: { red: 5, yellow: 10, green: 8 },
  weekly: [
    { day: "Mon", minutes: 24, sessions: 2 },
    { day: "Tue", minutes: 18, sessions: 1 },
    { day: "Wed", minutes: 42, sessions: 3 },
    { day: "Thu", minutes: 15, sessions: 1 },
    { day: "Fri", minutes: 36, sessions: 2 },
    { day: "Sat", minutes: 52, sessions: 4 },
    { day: "Sun", minutes: 28, sessions: 2 },
  ],
  weeklyDelta: 12.4,
  
}