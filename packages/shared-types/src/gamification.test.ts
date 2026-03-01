import { describe, expect, it } from "vitest";
import { applyTaskCompletionProgress, computeMood } from "./gamification";

describe("gamification progression", () => {
  it("updates xp, streak, level and mood", () => {
    const next = applyTaskCompletionProgress({
      xp: 30,
      streak: 2,
      level: 1,
      mood: "NEUTRAL",
      badges: []
    });

    expect(next.xp).toBe(40);
    expect(next.streak).toBe(3);
    expect(next.level).toBe(2);
    expect(next.mood).toBe("FOCUSED");
    expect(next.badges).toContain("Streak-3");
  });

  it("handles stressed mood for low xp", () => {
    expect(computeMood(0, 0)).toBe("STRESSED");
  });
});
