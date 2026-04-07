import { isAuthenticated } from "@/lib/auth.server";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) {
    // console.log("not authenticated");
    redirect("/login");
  }
  return children;
}
