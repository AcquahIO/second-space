import { describe, expect, it } from "vitest";
import { buildFallbackPmTurn } from "./fallback";
import { buildGithubAccessGuidance } from "../agent-chat/access-guidance";

describe("buildFallbackPmTurn", () => {
  it("asks natural clarifying questions when the request is underspecified", () => {
    const result = buildFallbackPmTurn("can you help me");

    expect(result.readyToExecute).toBe(false);
    expect(result.reply).toContain("Before I start");
  });

  it("marks the mission ready when outcome, context, and timing are present", () => {
    const result = buildFallbackPmTurn("Build release notes for the onboarding repo by Friday.");

    expect(result.readyToExecute).toBe(true);
    expect(result.reply).toContain("ready");
  });

  it("tells the user to connect GitHub for code review when GitHub is disconnected", () => {
    const result = buildGithubAccessGuidance("I want to review my code", {
      connected: false,
      repoFullName: null,
      defaultBranch: null,
      accountLabel: null,
      authStatus: "DISCONNECTED"
    });

    expect(result?.reply).toContain("GitHub is not connected");
    expect(result?.reply).toContain("Connect the GitHub integration");
    expect(result?.actionHints.map((hint) => hint.type)).toContain("CONNECT_GITHUB");
  });

  it("tells the user to bind a repository when GitHub is connected without a repo", () => {
    const result = buildGithubAccessGuidance("Please review my code", {
      connected: true,
      repoFullName: null,
      defaultBranch: null,
      accountLabel: "GitHub Workspace",
      authStatus: "CONNECTED"
    });

    expect(result?.reply).toContain("no repository is bound yet");
    expect(result?.actionHints.map((hint) => hint.type)).toContain("BIND_GITHUB_REPO");
  });
});
