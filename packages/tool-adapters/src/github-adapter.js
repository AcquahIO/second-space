function inferTargetBranch(input) {
    const fromContext = String(input.context?.targetBranch ?? "").trim();
    if (fromContext) {
        return fromContext;
    }
    const match = input.prompt.match(/branch\s+([a-zA-Z0-9/_-]+)/i);
    return match?.[1] ?? "";
}
export class GitHubAdapter {
    id;
    name;
    provider = "github";
    executionMode = "REAL";
    defaultBranch;
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.defaultBranch = options.defaultBranch ?? "main";
    }
    async execute(input) {
        const targetBranch = inferTargetBranch(input);
        if (targetBranch && [this.defaultBranch, "master"].includes(targetBranch)) {
            return {
                ok: false,
                output: "",
                error: `GitHub guardrail blocked direct push to protected branch: ${targetBranch}`
            };
        }
        return {
            ok: true,
            output: `[GITHUB] Prepared repository change for task ${input.taskId} on branch ${targetBranch || "feature/auto-task"}.`
        };
    }
}
