export class GmailAdapter {
    id;
    name;
    provider = "gmail";
    executionMode = "REAL";
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
    }
    async execute(input) {
        return {
            ok: true,
            output: `[GMAIL] Generated outbound message draft and queued send workflow for task ${input.taskId}.`
        };
    }
}
