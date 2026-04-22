'use client'

import Image from "next/image";
import { createClient } from '@/lib/supabase/client'
import {useEffect} from 'react'
import { Button } from "@/components/ui/button";
import '@fontsource/bitcount-grid-double';
import { ApiKey } from "@/components/api-key";


export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans dark:bg-black">
        <ApiKey/>
    </div>
  );
}