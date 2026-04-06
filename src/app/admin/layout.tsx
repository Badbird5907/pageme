import { getAuthClaims } from "@/lib/auth.server";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const claims = await getAuthClaims();
  console.log(claims);
  if (!claims) {
    redirect("/login");
  }
  if (!claims.admin) {
    redirect("/app");
  }
  return children;;
}
