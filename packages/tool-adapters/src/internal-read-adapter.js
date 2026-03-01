export class InternalReadAdapter {
    id;
    name;
    provider;
    executionMode = "MOCK";
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.provider = options.provider;
    }
    async execute(input) {
        return {
            ok: true,
            output: `[${this.provider.toUpperCase()}] Internal read-only tool executed for task ${input.taskId}. Prompt excerpt: ${input.prompt.slice(0, 220)}`
        };
    }
}
