import { describe, expect, it } from "vitest";
import { MockAdapter } from "./mock-adapter";

describe("MockAdapter", () => {
  it("returns a deterministic successful result", async () => {
    const adapter = new MockAdapter({ id: "mock-1", name: "Mock", provider: "slack", latencyMs: 1 });
    const result = await adapter.execute({
      prompt: "Send update",
      taskId: "task-1",
      workspaceId: "workspace-1",
      agentId: "agent-1"
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("task-1");
    expect(result.output).toContain("slack");
  });
});
