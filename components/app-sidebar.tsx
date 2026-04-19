"use client"

import { createClient } from '@/lib/supabase/client'
import {useEffect, useState} from "react";
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger
} from "@/components/ui/sidebar"
// import {
//   DropdownMenu,
//   DropdownMenuTrigger,
//   DropdownMenuContent,
//   DropdownMenuItem,
// } from "@/components/ui/dropdown-menu"
import { Plus, LayoutDashboard, IterationCw, FolderClock, Waypoints, Settings } from "lucide-react"
import '@fontsource/bitcount-grid-double';
import Link from "next/link"
import React from 'react'

export function AppSidebar() {
  const {state} = useSidebar();
  const supabase = createClient();
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setName(user?.user_metadata?.display_name ?? user?.email ?? "User");
    });
  }, []);
  
  return (
    <Sidebar collapsible="icon" className="border-zinc-200 bg-zinc-50 min-w-0 flex flex-row items-center">
      <SidebarHeader className={`flex flex-row items-center h-14 ${state === "expanded" ? "justify-between" : "justify-center"}`}>
        {state === "expanded" && (<h1 className="pl-2 font-['Bitcount_Grid_Double'] text-4xl">Cortex</h1>)}  
        <SidebarTrigger className = "shrink-0 z-10 relative" />        
      </SidebarHeader>
      <br/>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={{children: "New Session", side: "right"}}>
                      <Link href="/"><Plus /> {state === "expanded" && <span> New Session</span>}</Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <br/>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={{children: "Dashboard", side: "right"}}> 
                    <Link href="/dashboard"><LayoutDashboard/> {state === "expanded" && <span> Dashboard</span>}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={{children: "Review Queue", side: "right"}}> 
                    <Link href="/review"><IterationCw/> {state === "expanded" && <span> Review Queue</span>}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={{children: "Session History", side: "right"}}>
                    <Link href="/history"><FolderClock/>{state === "expanded" && <span> Session History</span>}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={{children: "Topic Map", side: "right"}}>
                    <Link href="/topic-map"><Waypoints/>{state === "expanded" && <span> Topic Map</span>}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton />
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton />
                      </SidebarMenuSubItem>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
              </SidebarMenuItem> 
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={{children: "Settings", side: "right"}}>
              <Link href="/topic-map"><Settings/>{state === "expanded" && <span> Settings</span>}</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton>
              
               {name}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}