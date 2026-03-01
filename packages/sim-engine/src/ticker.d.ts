import type { AgentState } from "@second-space/shared-types";
export interface SimAgent {
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number;
    state: AgentState;
}
export declare function stepTowards(current: number, target: number, step: number): number;
export declare function tickAgents(agents: SimAgent[], deltaMs: number): SimAgent[];
