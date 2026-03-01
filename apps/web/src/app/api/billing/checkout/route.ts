import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

function stripeCheckoutEndpoint(): string {
  return "https://api.stripe.com/v1/checkout/sessions";
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json().catch(() => ({}));
    const returnUrl = String(body.returnUrl ?? process.env.APP_BASE_URL ?? "http://localhost:3000");

    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      include: {
        subscription: true
      }
    });

    if (!workspace) {
      return jsonError("Workspace not found", 404);
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    const stripeSecret = process.env.STRIPE_SECRET_KEY;

    if (!priceId || !stripeSecret) {
      await prisma.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.sub,
          action: "BILLING_CHECKOUT_MOCKED",
          target: workspace.slug
        }
      });

      return NextResponse.json({
        checkoutUrl: `${returnUrl}?billing=mock`,
        mode: "mock"
      });
    }

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${returnUrl}?billing=success`);
    params.set("cancel_url", `${returnUrl}?billing=cancel`);
    params.set("client_reference_id", workspace.id);
    params.set("metadata[workspaceId]", workspace.id);

    if (workspace.subscription?.stripeCustomerId) {
      params.set("customer", workspace.subscription.stripeCustomerId);
    }

    const stripeResponse = await fetch(stripeCheckoutEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const payload = (await stripeResponse.json().catch(() => ({}))) as {
      id?: string;
      url?: string;
      customer?: string;
      error?: { message?: string };
    };

    if (!stripeResponse.ok || !payload.url) {
      throw new Error(payload.error?.message ?? "Failed to create Stripe checkout session");
    }

    await prisma.workspaceSubscription.upsert({
      where: { workspaceId: workspace.id },
      update: {
        stripeCustomerId: payload.customer ?? workspace.subscription?.stripeCustomerId ?? null,
        stripeSubscriptionId: workspace.subscription?.stripeSubscriptionId ?? null,
        status: workspace.subscription?.status ?? "TRIALING"
      },
      create: {
        workspaceId: workspace.id,
        status: "TRIALING",
        stripeCustomerId: payload.customer ?? null
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "BILLING_CHECKOUT_CREATED",
        target: payload.id ?? "stripe-session"
      }
    });

    return NextResponse.json({
      checkoutUrl: payload.url,
      mode: "live"
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not start checkout", 500);
  }
}
