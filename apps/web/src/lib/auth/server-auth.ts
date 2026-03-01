import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { bootstrapWorkspace } from "@/lib/workspace/bootstrap";
import { getSessionCookieName, verifySessionToken, type SessionPayload } from "@/lib/auth/session";

function slugifyWorkspaceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function ensureUniqueWorkspaceSlug(base: string): Promise<string> {
  const normalizedBase = base || `workspace-${Date.now()}`;

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? normalizedBase : `${normalizedBase}-${index + 1}`;
    const existing = await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now()}`;
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspace: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  const hash = user.passwordHash;
  const passwordMatchesHash = hash ? await bcrypt.compare(password, hash) : false;
  const passwordMatchesFallback = process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD;

  if (!passwordMatchesHash && !passwordMatchesFallback) {
    return null;
  }

  return user;
}

export async function createWorkspaceOwnerAccount(input: {
  email: string;
  password: string;
  workspaceName: string;
}) {
  const email = input.email.trim().toLowerCase();
  const workspaceName = input.workspaceName.trim();

  if (!email || !workspaceName) {
    throw new Error("Email and workspace name are required");
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    throw new Error("Account already exists for this email");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const slug = await ensureUniqueWorkspaceSlug(slugifyWorkspaceName(workspaceName));

  const created = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug,
        onboardingState: "WORKSPACE_SETUP"
      }
    });

    const user = await tx.user.create({
      data: {
        workspaceId: workspace.id,
        email,
        passwordHash,
        role: "OWNER",
        isWorkspaceOwner: true
      }
    });

    await tx.workspaceSubscription.create({
      data: {
        workspaceId: workspace.id,
        status: "TRIALING"
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "WORKSPACE_CREATED",
        target: workspace.slug,
        metadata: {
          email
        }
      }
    });

    return { user, workspace };
  });

  await bootstrapWorkspace(created.workspace.id);

  return created;
}

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(getSessionCookieName())?.value;
  return verifySessionToken(token);
}

export function getSessionFromCookies(): SessionPayload | null {
  const token = cookies().get(getSessionCookieName())?.value;
  return verifySessionToken(token);
}

export function unauthorizedJson() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function assertWorkspaceSubscriptionActive(workspaceId: string) {
  const subscription = await prisma.workspaceSubscription.findUnique({
    where: {
      workspaceId
    },
    select: {
      status: true
    }
  });

  if (!subscription) {
    throw new Error("No subscription found for workspace");
  }

  if (subscription.status === "PAST_DUE" || subscription.status === "CANCELED") {
    throw new Error(`Subscription status ${subscription.status} blocks execution`);
  }
}
