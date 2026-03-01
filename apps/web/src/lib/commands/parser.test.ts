import { describe, expect, it } from "vitest";
import { inferCommandMode, parseCommandText } from "./parser";

describe("command parser", () => {
  it("builds a specialist task graph", () => {
    const parsed = parseCommandText("Create a release summary and publish it to client LinkedIn", "execute");

    expect(parsed.intent.length).toBeGreaterThan(5);
    expect(parsed.proposedTasks.length).toBeGreaterThanOrEqual(4);
    expect(parsed.proposedTasks[0].assigneeSpecialistRole).toBe("PROJECT_MANAGER");
    expect(parsed.proposedTasks.some((task) => task.requiresApproval)).toBe(true);
  });

  it("keeps plan mode non-executable", () => {
    const parsed = parseCommandText("Ship the new onboarding release this week", "plan");
    expect(parsed.mode).toBe("plan");
    expect(parsed.proposedTasks.some((task) => task.externalAction)).toBe(false);
  });

  it("infers mode automatically from natural language intent", () => {
    expect(inferCommandMode("Brainstorm three product positioning options")).toBe("explore");
    expect(inferCommandMode("Review this sprint and summarize misses")).toBe("review");
    expect(inferCommandMode("Plan a migration roadmap for auth")).toBe("plan");
    expect(inferCommandMode("Implement the onboarding fixes and ship")).toBe("execute");
  });
});
