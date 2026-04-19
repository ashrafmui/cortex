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
    <SidebarProvider>
      <AppSidebar />
        <main className="flex-1">{children}</main>
    </SidebarProvider>
  );
}
