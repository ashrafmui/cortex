import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div>
      <SidebarProvider>
        <AppSidebar />
          <main className="flex w-full bg-white dark:bg-black px-8 pt-20">
            {children}
          </main>
    </SidebarProvider>
    </div>
    
  );
}
