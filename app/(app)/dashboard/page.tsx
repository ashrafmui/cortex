'use client'

import Image from "next/image";
import { createClient } from '@/lib/supabase/client'
import {useEffect, useState} from 'react'
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"
import { ChevronRightIcon, Link } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";


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

const MOCK = {
  name: "Muhaiminul",
  streak: 5,
  totalConcepts: 23,
  overallMastery: 64,
  dueForReview: 4,
  topics: [
    { id: "1", name: "Pointers in C", mastery: 82, status: "strong" },
    { id: "2", name: "Memory Management", mastery: 45, status: "developing" },
    { id: "3", name: "Linked Lists", mastery: 71, status: "strong" },
    { id: "4", name: "Recursion", mastery: 18, status: "weak" },
    { id: "5", name: "Binary Trees", mastery: 25, status: "weak" },
    { id: "6", name: "Dynamic Programming", mastery: 31, status: "developing" },
  ],
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
}

type Topic = {
  id: string;
  name: string;
  mastery: number;
  status: string;
};

export function Mastery({ value, topics }: { value: number; topics: Topic[] }){
  return(
    <Card className="group min-w-0 flex-1 hover:bg-red-300 hover:text-black transition-colors duration-300">
      <CardHeader className = "flex flex-row items-center justify-between w-full">
        <CardTitle className = "text-black text-2xl">Overall Mastery</CardTitle>
        <NumberTicker value = {value} className = "text-2xl"/>
        {/* <CardDescription className = "text-green-400 font-semibold">Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <div className = "bg-transparent">
          {topics.map((topics) => 
          <Button 
            key = {topics.id} 
            className = "relative flex flex-col sm:flex-row gap-5 w-full justify-between bg-transparent hover:bg-stone-50 overflow-hidden"
            >
            {/* Fill bar */}
              <p className = "text-black">{topics.name}</p>
              <div 
                className={`absolute left-0 top-0 h-full ${
                  topics.status === "strong" ? "bg-green-200" :
                  topics.status === "developing" ? "bg-yellow-200" :
                  "bg-red-200"
                }`}
                style={{ width: `${topics.mastery}%` }}
              />
              {/* <p className = "text-black">{topics.mastery}</p> */}
              <NumberTicker value = {topics.mastery}/>
          </Button>
          )}
          {/* <Button className = "flex flex-col sm:flex-row gap-5 w-full justify-between bg-transparent hover:bg-stone-50">
              
          </Button>
          <Button className = "flex flex-col sm:flex-row gap-5 w-full justify-between bg-transparent hover:bg-stone-50">
            <div className = "flex flex-row items-center justify-between">
              <p className = "text-black">Progress</p>
            </div>
          </Button> */}
        </div>
        {/* insert actual values for progress fetched from the supabase api for user */}
      </CardContent>
      <CardFooter>
        <CardAction className = "flex flex-row items-center justify-end w-full">
            <ChevronRightIcon strokeWidth={1.5} className = "opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </CardAction>
      </CardFooter>
    </Card>
  )
}

  {/* Due for Review Component */}
export function Review(){
  return (
    <Card className="min-w-0 flex-1 hover:-green-500 hover:text-black transition-colors duration-300">
      <CardHeader>
        <CardTitle className = "text-xl">Due for Review</CardTitle>
        <CardDescription className = "text-green-300 font-semibold"></CardDescription>
      </CardHeader>
      <CardContent>

      </CardContent>
      <CardFooter>
      </CardFooter>
    </Card>
  )
}

export function Streak(){
  return (
    <Card className="min-w-0 flex-1 hover:bg-green-500 hover:text-white transition-colors duration-300">
      <CardHeader>
        <CardTitle className = "text-xl">Weekly Progress</CardTitle>
        <CardDescription className = "text-green-300 font-semibold"></CardDescription>
      </CardHeader>
      <CardContent>

      </CardContent>
      <CardFooter>
      </CardFooter>
    </Card>
  )
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
          <div className = "flex flex-col sm:flex-row gap-5 w-full mt-6 justify-between">
            <h1 className="text-4xl font-light">Hello, <span className = "font-semibold">{name}</span></h1>
            <div className="flex flex-col ">
              <h4 className = "">Streak</h4>
              <h3 className = ""></h3>
            </div>
        </div>
        <br/>
        <div className = "flex flex-col sm:flex-row gap-5 w-full mt-6">
          {/* Mastery Component */}
          <Mastery value = {MOCK.overallMastery} topics={MOCK.topics}/>
          <Review />
          <Streak />
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
