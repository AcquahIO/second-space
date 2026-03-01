import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";

export interface GitHubAdapterOptions {
  id: string;
  name: string;
  defaultBranch?: string;
}

function inferTargetBranch(input: ToolExecutionInput): string {
  const fromContext = String(input.context?.targetBranch ?? "").trim();
  if (fromContext) {
    return fromContext;
  }

  const match = input.prompt.match(/branch\s+([a-zA-Z0-9/_-]+)/i);
  return match?.[1] ?? "";
}

export class GitHubAdapter implements ToolBinding {
  id: string;
  name: string;
  provider = "github";
  executionMode: ExecutionMode = "REAL";
  private defaultBranch: string;

  constructor(options: GitHubAdapterOptions) {
    this.id = options.id;
    this.name = options.name;
    this.defaultBranch = options.defaultBranch ?? "main";
  }

  async execute(input: ToolExecutionInput): Promise<AdapterResult> {
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
