'use client'

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import { ChevronRightIcon} from "lucide-react";
import { useRouter } from "next/navigation"
import { Topic } from "@/lib/data";

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

export function Review({topics} : {topics: Topic[]}){
  const router = useRouter();

  return (
    <Card className="group min-w-0 flex-1 hover:bg-slate-100 transition-colors duration-300"
          onClick={() => router.push("/review")}
    >
      <CardHeader className = "flex flex-row items-center justify-between w-full pb-4">
        <CardTitle className = "text-2xl">Due for Review</CardTitle>
        <CardDescription className = "text-green-600 font-medium">
          {topics.length} topics{topics.length !== 1 } need attention
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
          {topics.map((topic) => (
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