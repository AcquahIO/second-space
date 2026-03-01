import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { AGENT_CONTRACTS } from "@second-space/shared-types";
import { buildContractPrompt, redactSensitiveText } from "./memory";

describe("memory redaction", () => {
  it("redacts token-like strings", () => {
    const input = "Use token sk-abc123abc123abc123abc123 and bearer abcdef123456";
    const output = redactSensitiveText(input);

    expect(output.redacted).toBe(true);
    expect(output.content).toContain("[REDACTED_SECRET]");
  });

  it("keeps normal text unchanged", () => {
    const input = "Review deployment checklist and update docs.";
    const output = redactSensitiveText(input);

    expect(output.redacted).toBe(false);
    expect(output.content).toBe(input);
  });
});

describe("contract prompt composition", () => {
  it("uses base contract when no approved proposal exists", async () => {
    const prisma = {
      contractProposal: {
        findFirst: async () => null,
        count: async () => 0
      }
    } as unknown as PrismaClient;

    const prompt = await buildContractPrompt(prisma, {
      workspaceId: "workspace-1",
      agentId: "agent-1",
      specialistRole: "PROJECT_MANAGER"
    });

    expect(prompt).toContain("Contract Version: v1");
    expect(prompt).toContain(`Role: ${AGENT_CONTRACTS.PROJECT_MANAGER.title}`);
  });

  it("applies approved proposal contract fields for active prompt", async () => {
    const prisma = {
      contractProposal: {
        findFirst: async () => ({
          proposedContract: {
            operatingPrinciple: "Run strict reflection-driven execution and never auto-apply behavior changes."
          }
        }),
        count: async () => 1
      }
    } as unknown as PrismaClient;

    const prompt = await buildContractPrompt(prisma, {
      workspaceId: "workspace-1",
      agentId: "agent-1",
      specialistRole: "PROJECT_MANAGER"
    });

    expect(prompt).toContain("Contract Version: v2");
    expect(prompt).toContain(
      "Operating Principle: Run strict reflection-driven execution and never auto-apply behavior changes."
    );
  });
});
