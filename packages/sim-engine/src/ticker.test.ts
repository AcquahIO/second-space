import { describe, expect, it } from "vitest";
import { tickAgents } from "./ticker";

describe("tickAgents", () => {
  it("moves agents toward targets", () => {
    const [agent] = tickAgents(
      [
        {
          id: "a1",
          x: 0,
          y: 0,
          targetX: 10,
          targetY: 10,
          speed: 60,
          state: "IDLE"
        }
      ],
      1000
    );

    expect(agent.x).toBeGreaterThan(0);
    expect(agent.y).toBeGreaterThan(0);
  });
});
