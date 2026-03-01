"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Login failed");
      }

      window.location.href = "/";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.65rem" }}>
      <label>
        <div style={{ marginBottom: "0.3rem", fontSize: "0.8rem" }}>Email</div>
        <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>

      <label>
        <div style={{ marginBottom: "0.3rem", fontSize: "0.8rem" }}>Password</div>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error ? <div style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{error}</div> : null}

      <button className="btn btn-accent" disabled={loading} type="submit">
        {loading ? "Signing in..." : "Enter Office"}
      </button>

      <div style={{ fontSize: "0.8rem", color: "var(--ink-dim)" }}>
        New here? <Link href="/signup">Create a workspace</Link>
      </div>
    </form>
  );
}
