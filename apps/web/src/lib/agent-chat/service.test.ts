import { describe, expect, it } from "vitest";
import { buildFallbackAgentTurn } from "./fallback";

describe("buildFallbackAgentTurn", () => {
  it("keeps specialist responses domain-specific", () => {
    const result = buildFallbackAgentTurn({
      agentName: "Taylor",
      agentTitle: "Tech Lead",
      specialty: "architecture and implementation planning",
      operatorContext: "Can you review this auth refactor?"
    });

    expect(result.readyToExecute).toBe(false);
    expect(result.reply).toContain("architecture");
  });

  it("redirects broad orchestration asks back toward PM", () => {
    const result = buildFallbackAgentTurn({
      agentName: "Taylor",
      agentTitle: "Tech Lead",
      specialty: "architecture and implementation planning",
      operatorContext: "Coordinate the whole team and ship this release."
    });

    expect(result.reply).toContain("PM");
  });

  it("surfaces missing GitHub setup for code review requests", () => {
    const result = buildFallbackAgentTurn({
      agentName: "Taylor",
      agentTitle: "Tech Lead",
      specialty: "architecture and implementation planning",
      operatorContext: "Can you review my code?",
      github: {
        connected: false,
        repoFullName: null,
        defaultBranch: null,
        accountLabel: null,
        authStatus: "DISCONNECTED"
      }
    });

    expect(result.reply).toContain("GitHub is not connected");
  });
});
