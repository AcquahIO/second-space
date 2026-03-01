import { getSessionFromCookies } from "@/lib/auth/server-auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  const session = getSessionFromCookies();

  if (session) {
    redirect("/");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>SECOND SPACE LOGIN</h1>
        <p style={{ color: "var(--ink-dim)", marginTop: 0 }}>Control your agent workforce.</p>
        <LoginForm />
      </div>
    </div>
  );
}
