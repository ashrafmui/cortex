'use client'

import Image from "next/image";
import { createClient } from '@/lib/supabase/client'
import {useEffect} from 'react'
import { Button } from "@/components/ui/button";
import '@fontsource/bitcount-grid-double';
// import (user)
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main>
        <h1 className="pl-2 text-20xl">Hello, </h1>
        */insert user display name/*
      </main>
    </div>
  );
}
