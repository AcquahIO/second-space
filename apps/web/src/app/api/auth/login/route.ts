import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/server-auth";
import { createSessionToken, getSessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return jsonError("Email and password are required", 400);
    }

    const user = await authenticateUser(email, password);

    if (!user) {
      return jsonError("Invalid credentials", 401);
    }

    const token = createSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(getSessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Login failed", 500);
  }
}
