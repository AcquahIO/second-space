import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getSessionFromCookies } from "@/lib/auth/server-auth";

export default function HomePage() {
  const session = getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  return <Dashboard session={session} />;
}
