'use client'

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRightIcon} from "lucide-react";
import { useRouter } from "next/navigation";
import { NumberTicker } from "../ui/number-ticker";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis } from "recharts";
import { weeklyChartConfig, minutesTier } from "@/lib/data";

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