import type { Mood } from "./domain";
export interface ProgressState {
    xp: number;
    streak: number;
    level: number;
    mood: Mood;
    badges: string[];
}
export declare function computeMood(xp: number, streak: number): Mood;
export declare function applyTaskCompletionProgress(current: ProgressState): ProgressState;
