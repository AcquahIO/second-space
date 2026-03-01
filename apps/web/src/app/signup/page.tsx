import { getSessionFromCookies } from "@/lib/auth/server-auth";
import { redirect } from "next/navigation";
import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
  const session = getSessionFromCookies();

  if (session) {
    redirect("/");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>SECOND SPACE SIGNUP</h1>
        <p style={{ color: "var(--ink-dim)", marginTop: 0 }}>Create your agent workforce workspace.</p>
        <SignupForm />
      </div>
    </div>
  );
}
