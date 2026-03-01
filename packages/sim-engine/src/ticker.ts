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

export function stepTowards(current: number, target: number, step: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= step) {
    return target;
  }
  return current + Math.sign(delta) * step;
}

export function tickAgents(agents: SimAgent[], deltaMs: number): SimAgent[] {
  const step = Math.max(1, (deltaMs / 1000) * 60);

  return agents.map((agent) => {
    const nextX = stepTowards(agent.x, agent.targetX, step * (agent.speed / 60));
    const nextY = stepTowards(agent.y, agent.targetY, step * (agent.speed / 60));

    const arrived = nextX === agent.targetX && nextY === agent.targetY;
    const nextState: AgentState = arrived ? "IDLE" : "MOVING";

    return {
      ...agent,
      x: nextX,
      y: nextY,
      state: nextState
    };
  });
}
