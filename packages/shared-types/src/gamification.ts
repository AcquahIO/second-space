import type { Mood } from "./domain";

export interface ProgressState {
  xp: number;
  streak: number;
  level: number;
  mood: Mood;
  badges: string[];
}

export function computeMood(xp: number, streak: number): Mood {
  if (streak >= 3) return "FOCUSED";
  if (xp < 10) return "STRESSED";
  return "NEUTRAL";
}

export function applyTaskCompletionProgress(current: ProgressState): ProgressState {
  const xp = current.xp + 10;
  const streak = current.streak + 1;
  const level = Math.max(1, Math.floor(xp / 40) + 1);
  const mood = computeMood(xp, streak);

  const badges = [...current.badges];
  if (streak >= 3 && !badges.includes("Streak-3")) {
    badges.push("Streak-3");
  }

  if (xp >= 100 && !badges.includes("Century-XP")) {
    badges.push("Century-XP");
  }

  return {
    xp,
    streak,
    level,
    mood,
    badges
  };
}
