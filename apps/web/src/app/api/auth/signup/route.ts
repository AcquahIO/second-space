import { NextResponse } from "next/server";
import { createWorkspaceOwnerAccount } from "@/lib/auth/server-auth";
import { createSessionToken, getSessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const workspaceName = String(body.workspaceName ?? "").trim();

    if (!email || !password || !workspaceName) {
      return jsonError("workspaceName, email, and password are required", 400);
    }

    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }

    const created = await createWorkspaceOwnerAccount({
      email,
      password,
      workspaceName
    });

    const token = createSessionToken({
      sub: created.user.id,
      email: created.user.email,
      role: created.user.role,
      workspaceId: created.workspace.id
    });

    const response = NextResponse.json({
      ok: true,
      workspace: {
        id: created.workspace.id,
        name: created.workspace.name,
        slug: created.workspace.slug
      }
    });

    response.cookies.set(getSessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Signup failed", 500);
  }
}
