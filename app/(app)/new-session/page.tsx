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
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function NewSession() {
  const [input, setInput] = useState("")

  return (

    // <div className = "w-full">
    //         <div className = "flex flex-col sm:flex-row w-full font-light">
    //           <h1 className="text-4xl">Review Queue</h1>
    //             <h3 className = ""></h3>
    //           </div>
    // </div>
    <div className="w-full">
      <div className="w-full max-w-lg">
        <div>
          <div className="text-2xl">Start a Session</div>
          <div>What do you want to learn about?</div>
        </div>
        <div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Pointers in C, Binary Trees, Dynamic Programming..."
            className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
        <div className="justify-end">
          <Button disabled={!input.trim()}>
            Begin
          </Button>
        </div>
      </div>
    </div>
  )
}