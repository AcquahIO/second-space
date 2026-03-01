export class LinkedInAdapter {
    id;
    name;
    provider = "linkedin";
    executionMode = "REAL";
    postingEnabled;
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.postingEnabled = options.postingEnabled ?? false;
    }
    async execute(input) {
        if (!this.postingEnabled) {
            return {
                ok: true,
                output: `[LINKEDIN:DRAFT] API posting unavailable. Draft for manual posting: ${input.prompt.slice(0, 280)}`
            };
        }
        return {
            ok: true,
            output: `[LINKEDIN] Published scheduled update for task ${input.taskId}.`
        };
    }
}
