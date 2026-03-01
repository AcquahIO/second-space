export function stepTowards(current, target, step) {
    const delta = target - current;
    if (Math.abs(delta) <= step) {
        return target;
    }
    return current + Math.sign(delta) * step;
}
export function tickAgents(agents, deltaMs) {
    const step = Math.max(1, (deltaMs / 1000) * 60);
    return agents.map((agent) => {
        const nextX = stepTowards(agent.x, agent.targetX, step * (agent.speed / 60));
        const nextY = stepTowards(agent.y, agent.targetY, step * (agent.speed / 60));
        const arrived = nextX === agent.targetX && nextY === agent.targetY;
        const nextState = arrived ? "IDLE" : "MOVING";
        return {
            ...agent,
            x: nextX,
            y: nextY,
            state: nextState
        };
    });
}
