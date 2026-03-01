export class MockAdapter {
    id;
    name;
    provider;
    executionMode = "MOCK";
    latencyMs;
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.provider = options.provider ?? "mock";
        this.latencyMs = options.latencyMs ?? 500;
    }
    async execute(input) {
        await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
        return {
            ok: true,
            output: `[MOCK:${this.provider}] Completed task ${input.taskId} for agent ${input.agentId}. Prompt summary: ${input.prompt.slice(0, 120)}`
        };
    }
}
