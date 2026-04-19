'use client'

import Image from "next/image";
import { createClient } from '@/lib/supabase/client'
import {useEffect, useState} from 'react'
import { Button } from "@/components/ui/button";
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

export default function Home() {

  const supabase = createClient();
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setName(user?.user_metadata?.display_name ?? user?.email ?? "User");
    });
  }, []);   

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="pl-2 text-4xl">Hello, <span className = "font-semibold">{name}</span></h1>
        <br/>
        <div>
        <Card className="min-w-sm">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Card Description</CardDescription>
            <CardAction>Card Action</CardAction>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Card Description</CardDescription>
            <CardAction>Card Action</CardAction>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>

      </main>
    </div>
  );
}
