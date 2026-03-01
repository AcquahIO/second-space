"use client";

import { FormEvent, useState } from "react";

export default function SignupForm() {
  const [workspaceName, setWorkspaceName] = useState("My SaaS Workspace");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceName, email, password })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Signup failed");
      }

      window.location.href = "/";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.65rem" }}>
      <label>
        <div style={{ marginBottom: "0.3rem", fontSize: "0.8rem" }}>Workspace Name</div>
        <input className="input" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
      </label>

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
        {loading ? "Creating workspace..." : "Create Workspace"}
      </button>
    </form>
  );
}
