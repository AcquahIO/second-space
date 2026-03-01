import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { jsonError } from "@/lib/utils/http";

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function mapStripeStatus(status: string): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" {
  if (status === "trialing") {
    return "TRIALING";
  }

  if (status === "active") {
    return "ACTIVE";
  }

  if (status === "past_due" || status === "unpaid") {
    return "PAST_DUE";
  }

  return "CANCELED";
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const stripeSignature = request.headers.get("stripe-signature") ?? "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret && !verifyStripeSignature(payload, stripeSignature, webhookSecret)) {
      return jsonError("Invalid Stripe signature", 400);
    }

    const event = JSON.parse(payload) as {
      type: string;
      data?: {
        object?: Record<string, unknown>;
      };
    };

    const object = event.data?.object ?? {};

    if (event.type === "checkout.session.completed") {
      const workspaceId = String((object.metadata as Record<string, unknown> | undefined)?.workspaceId ?? "");
      const customerId = String(object.customer ?? "");
      const subscriptionId = String(object.subscription ?? "");

      if (workspaceId) {
        await prisma.workspaceSubscription.upsert({
          where: {
            workspaceId
          },
          update: {
            status: "ACTIVE",
            stripeCustomerId: customerId || null,
            stripeSubscriptionId: subscriptionId || null
          },
          create: {
            workspaceId,
            status: "ACTIVE",
            stripeCustomerId: customerId || null,
            stripeSubscriptionId: subscriptionId || null
          }
        });

        await prisma.workspaceOnboardingStep.upsert({
          where: {
            workspaceId_step: {
              workspaceId,
              step: "SUBSCRIPTION_ACTIVE"
            }
          },
          update: {
            completedAt: new Date()
          },
          create: {
            workspaceId,
            step: "SUBSCRIPTION_ACTIVE"
          }
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscriptionId = String(object.id ?? "");
      const customerId = String(object.customer ?? "");
      const status = mapStripeStatus(String(object.status ?? "canceled"));
      const currentPeriodEnd = Number(object.current_period_end ?? 0);
      const cancelAtPeriodEnd = Boolean(object.cancel_at_period_end ?? false);

      const subscription = await prisma.workspaceSubscription.findFirst({
        where: {
          OR: [
            ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
            ...(customerId ? [{ stripeCustomerId: customerId }] : [])
          ]
        }
      });

      if (subscription) {
        await prisma.workspaceSubscription.update({
          where: { workspaceId: subscription.workspaceId },
          data: {
            status,
            currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
            cancelAtPeriodEnd,
            stripeSubscriptionId: subscriptionId || subscription.stripeSubscriptionId,
            stripeCustomerId: customerId || subscription.stripeCustomerId
          }
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Webhook processing failed", 500);
  }
}
