import { describe, expect, it } from "vitest";
import { createToolAdapter } from "./factory";

describe("adapter factory", () => {
  it("falls back to mock when OpenAI key is missing", async () => {
    const adapter = createToolAdapter({
      toolId: "tool-openai",
      toolName: "OpenAI Core",
      provider: "openai",
      executionMode: "REAL",
      config: {}
    });

    const result = await adapter.execute({
      prompt: "Test",
      taskId: "task-1",
      workspaceId: "workspace-1",
      agentId: "agent-1"
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("MOCK");
  });

  it("uses github adapter and enforces default branch guardrail", async () => {
    const adapter = createToolAdapter({
      toolId: "tool-github",
      toolName: "GitHub Workspace",
      provider: "github",
      executionMode: "REAL",
      config: {
        defaultBranch: "main"
      }
    });

    const blocked = await adapter.execute({
      prompt: "Commit this change to branch main",
      taskId: "task-2",
      workspaceId: "workspace-1",
      agentId: "agent-2"
    });

    expect(blocked.ok).toBe(false);
  });

  it("uses mock adapter for unknown providers", async () => {
    const adapter = createToolAdapter({
      toolId: "tool-slack",
      toolName: "Slack Mock",
      provider: "slack",
      executionMode: "MOCK",
      config: null
    });

    const result = await adapter.execute({
      prompt: "Notify",
      taskId: "task-3",
      workspaceId: "workspace-1",
      agentId: "agent-3"
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("slack");
  });

  it("uses internal read adapter for scaffold providers", async () => {
    const adapter = createToolAdapter({
      toolId: "tool-ci-logs",
      toolName: "CI/CD Logs",
      provider: "ci-logs",
      executionMode: "MOCK",
      config: null
    });

    const result = await adapter.execute({
      prompt: "Fetch failed jobs from latest run",
      taskId: "task-4",
      workspaceId: "workspace-1",
      agentId: "agent-4"
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("CI-LOGS");
  });
});
