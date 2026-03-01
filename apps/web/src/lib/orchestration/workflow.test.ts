import { describe, expect, it } from "vitest";
import { parseCommandText } from "../commands/parser";
import { canTransition } from "@second-space/shared-types";

describe("workflow integration contracts", () => {
  it("flags external actions for approval", () => {
    const parsed = parseCommandText("Draft campaign copy and publish to client channel", "execute");
    expect(parsed.proposedTasks.some((task) => task.requiresApproval)).toBe(true);
  });

  it("plan mode does not create external actions", () => {
    const parsed = parseCommandText("Draft campaign copy and publish to client channel", "plan");
    expect(parsed.proposedTasks.some((task) => task.externalAction)).toBe(false);
  });

  it("keeps approval path legal", () => {
    expect(canTransition("PENDING_APPROVAL", "IN_PROGRESS")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "DONE")).toBe(true);
  });
});
