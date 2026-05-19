'use client'

import { useEffect, useState } from "react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import { NumberTicker } from "../ui/number-ticker";
import { ChevronRightIcon} from "lucide-react";
import { useRouter } from "next/navigation"
import { statusColors, Topic } from "@/lib/data";

// const statusColors = {
//   strong: { bg: "bg-green-200", text: "text-green-500" },
//   developing: { bg: "bg-yellow-200", text: "text-yellow-500" },
//   weak: { bg: "bg-red-200", text: "text-red-500" },
// } as const;

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
