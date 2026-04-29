'use client'

import Image from "next/image";
import { createClient } from '@/lib/supabase/client'
import {useEffect, useState} from 'react'
// import { Button } from "@/components/ui/button";
// import { Progress } from "@/components/ui/progress"
import { ChevronRightIcon, Link } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useRouter } from "next/navigation"
import { Bar, BarChart, Cell, XAxis } from "recharts"
import Streak from "@/components/streak";



import '@fontsource/bitcount-grid-double';
// import (user)
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const MOCK = {
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

const weeklyChartConfig = {
  minutes: { label: "Minutes" },
  strong: { label: "Strong", color: "#bbf7d0" },
  developing: { label: "Developing", color: "#fef08a" },
  weak: { label: "Weak", color: "#fecaca" },
} satisfies ChartConfig

const minutesTier = (minutes: number): "strong" | "developing" | "weak" =>
  minutes >= 40 ? "strong" : minutes >= 20 ? "developing" : "weak"

const statusColors = {
  strong: { bg: "bg-green-200", text: "text-green-500" },
  developing: { bg: "bg-yellow-200", text: "text-yellow-500" },
  weak: { bg: "bg-red-200", text: "text-red-500" },
} as const;

type Topic = {
  id: string;
  name: string;
  mastery: number;
  status: "strong" | "developing" | "weak";
  lastReviewed: string;
};



export function Mastery({ value, delta, topics }: { value: number; delta: number, topics: Topic[] }) {
  const [animated, setAnimated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className="group min-w-0 flex-1 hover:bg-slate-100 hover:text-black transition-colors duration-300"
    onClick={() => router.push("/topics")}
    >
      <CardHeader className="flex flex-row items-center justify-between w-full">
        <CardTitle className="text-black text-2xl">Overall Mastery</CardTitle>
        <NumberTicker value={value} className="text-2xl" />
      </CardHeader>
      <CardDescription className={`px-4 ${delta >= 0 ? "text-green-600 font-medium" : "text-red-500 text-lg"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% from last week
      </CardDescription>
      <CardContent className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
          {topics.map((topic) => {
            const colors = statusColors[topic.status];
            return (
              <div
                key={topic.id}
                className="relative flex flex-row items-center w-full justify-between px-4 py-1 rounded-md cursor-pointer hover:bg-stone-50 overflow-hidden"
              >
                <div
                  className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out ${colors.bg}`}
                  style={{ width: animated ? `${topic.mastery}%` : "0%" }}
                />
                <p className="relative z-10 text-black text-sm">{topic.name}</p>
                <NumberTicker
                  value={topic.mastery}
                  className={`relative z-10 ${colors.text}`}
                />
              </div>
            );
          })}
      </CardContent>
      <CardFooter className = "mt-auto">
        <CardAction className="flex flex-row items-center justify-end w-full">
          <ChevronRightIcon
            strokeWidth={1.5}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        </CardAction>
      </CardFooter>
    </Card>
  );
}

function MasteryRing({ value, size = 28, strokeWidth = 3 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (1 - value / 100);

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={filled}
        strokeLinecap="round"
        className="text-red-500"
      />
    </svg>
  );
}

  {/* Due for Review Component */}
export function Review({topics} : {topics: Topic[]}){
  const threshold = 40;
  const dueTopics = topics.filter((t) => t.mastery < threshold)
  const router = useRouter();

  return (
    <Card className="group min-w-0 flex-1 hover:bg-slate-100 transition-colors duration-300"
          onClick={() => router.push("/review")}
    >
      <CardHeader className = "flex flex-row items-center justify-between w-full pb-4">
        <CardTitle className = "text-2xl">Due for Review</CardTitle>
        <CardDescription className = "text-green-600 font-medium">
          {dueTopics.length} topics{dueTopics.length !== 1 } need attention
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
          {dueTopics.map((topic) => (
            <div key={topic.id} className="flex justify-between items-center text-sm">
              <div className="flex flex-col">
                <span>{topic.name}</span>
                <span className="text-xs text-muted-foreground">Last Reviewed: {topic.lastReviewed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-500">{topic.mastery}%</span>
                <MasteryRing value={topic.mastery} />
              </div>
            </div>
          ))}
      </CardContent>
      <CardFooter className = "mt-auto">
        <CardAction className="flex flex-row items-center justify-end w-full">
            <ChevronRightIcon
              strokeWidth={1.5}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            />
        </CardAction>
      </CardFooter>
    </Card>
  )
}

export function WeeklyProgress({
  data,
  delta,
}: {
  data: { day: string; minutes: number; sessions: number }[];
  delta: number;
}) {
  const router = useRouter();
  const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);
  const totalSessions = data.reduce((sum, d) => sum + d.sessions, 0);

  return (
    <Card
      className="group min-w-0 flex-1 hover:bg-slate-100 transition-colors duration-300"
      onClick={() => router.push("/history")}
    >
      <CardHeader className="flex flex-row items-center justify-between w-full">
        <CardTitle className="text-2xl">Weekly Progress</CardTitle>
        <NumberTicker value={totalMinutes} className="text-2xl" />
      </CardHeader>
      <CardDescription
        className={`px-4 ${delta >= 0 ? "text-green-600 font-medium" : "text-red-500"}`}
      >
        {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% from last week · {totalSessions} sessions
      </CardDescription>
      <CardContent>
        <ChartContainer config={weeklyChartConfig} className="h-[200px] w-full">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              {(["strong", "developing", "weak"] as const).map((tier) => (
                <linearGradient
                  key={tier}
                  id={`fill-${tier}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={`var(--color-${tier})`} stopOpacity={1} />
                  <stop offset="100%" stopColor={`var(--color-${tier})`} stopOpacity={0.25} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(label) => `${label} · minutes studied`}
                />
              }
            />
            <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={`url(#fill-${minutesTier(entry.minutes)})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className = "mt-auto">
        <CardAction className="flex flex-row items-center justify-end w-full">
          <ChevronRightIcon
            strokeWidth={1.5}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        </CardAction>
      </CardFooter>
    </Card>
  );
}


export default function Home() {

  const supabase = createClient();
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setName(user?.user_metadata?.display_name ?? user?.email ?? "User");
    });
  }, []);   


  return (
    <div className = "w-full">
          <div className = "flex flex-col sm:flex-row w-full justify-between">
            <h1 className="text-4xl font-light">Hello, <span className = "font-semibold">{name}</span></h1>
            <div className="flex flex-col ">
              <Streak count={MOCK.streak} lastSevenDays={MOCK.lastSevenDays} />
              <h3 className = ""></h3>
          </div>
        </div>
        <br/>
        <div className = "flex flex-col sm:flex-row gap-5 w-full mt-6">
          {/* Mastery Component */}
          <Mastery value = {MOCK.overallMastery} delta={MOCK.masteryDelta} topics={MOCK.topics}/>
          <Review topics = {MOCK.topics}/>
          <WeeklyProgress data={MOCK.weekly} delta={MOCK.weeklyDelta} />
          {/* Streak Counter Component */}
          {/* <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle className = "text-xl">Due for Review</CardTitle>
              <CardDescription className = "text-green-950 font-semibold"></CardDescription>
            </CardHeader>
            <CardContent>
              <div className = "pb-2 flex flex-row items-center justify-between">
              </div>
              <Progress className = "" value={72} />
            </CardContent>
            <CardFooter>
            </CardFooter>
          </Card> */}
        </div>
    </div>
        

  );
}
