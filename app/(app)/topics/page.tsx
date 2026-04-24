'use client'

import Image from "next/image";
import { createClient } from '@/lib/supabase/client'
import {useEffect} from 'react'
import { Button } from "@/components/ui/button";
import '@fontsource/bitcount-grid-double';


export default function Home() {
  return (
    <div className = "w-full">
            <div className = "flex flex-col sm:flex-row w-full font-light">
              <h1 className="text-4xl">Topics</h1>
                <h3 className = ""></h3>
              </div>
    </div>
  )
}