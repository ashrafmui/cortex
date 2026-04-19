"use client"

import { useSidebar } from "@/components/ui/sidebar"
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Plus, LayoutDashboard, IterationCw, FolderClock, Waypoints } from "lucide-react"
import '@fontsource/bitcount-grid-double';



export function AppSidebar() {
  const {state} = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-zinc-200 bg-zinc-50 min-w-0 flex flex-row items-center">
      <SidebarHeader className={`flex flex-row items-center h-14 ${state === "expanded" ? "justify-between" : "justify-center"}`}>
        {state === "expanded" && (<h1 className="pl-2 font-['Bitcount_Grid_Double'] text-4xl">Cortex</h1>)}  
        <SidebarTrigger className = "shrink-0 z-10 relative" />        
      </SidebarHeader>
      <br/>
      <SidebarGroup>
        <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                  <SidebarMenuButton> <Plus /> {state === "expanded" && <span> New Session</span>}</SidebarMenuButton>
              </SidebarMenuItem>
              <br/>
              <SidebarMenuItem>
                <SidebarMenuButton> <LayoutDashboard/> {state === "expanded" && <span> Dashboard</span>}</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton> <IterationCw/> {state === "expanded" && <span> Review Queue</span>}</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton><FolderClock/>{state === "expanded" && <span> Session History</span>}</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton><Waypoints/>{state === "expanded" && <span> Topic Map</span>}</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
              {/* <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    Select Workspace
                    <ChevronDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                  <DropdownMenuItem>
                    <span>Cortex</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>  */}
          </SidebarMenuItem> 
        </SidebarMenu>
        <SidebarGroup />
        <SidebarGroup />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
               Username
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}