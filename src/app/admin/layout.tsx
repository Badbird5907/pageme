import { getAuthClaims } from "@/lib/auth.server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const claims = await getAuthClaims();
  if (!claims) {
    redirect("/login");
  }
  if (!claims.admin) {
    redirect("/app");
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-h-[calc(100svh-3.5rem)]">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 md:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
