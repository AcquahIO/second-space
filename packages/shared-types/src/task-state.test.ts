import { describe, expect, it } from "vitest";
import { assertTaskTransition, canTransition } from "./task-state";

describe("task transitions", () => {
  it("allows expected transitions", () => {
    expect(canTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "IN_PROGRESS")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("DONE", "IN_PROGRESS")).toBe(false);
    expect(() => assertTaskTransition("DONE", "ASSIGNED")).toThrow("Illegal task transition");
  });
});
