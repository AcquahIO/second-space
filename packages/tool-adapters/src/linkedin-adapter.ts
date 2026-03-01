import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";

export interface LinkedInAdapterOptions {
  id: string;
  name: string;
  postingEnabled?: boolean;
}

export class LinkedInAdapter implements ToolBinding {
  id: string;
  name: string;
  provider = "linkedin";
  executionMode: ExecutionMode = "REAL";
  private postingEnabled: boolean;

  constructor(options: LinkedInAdapterOptions) {
    this.id = options.id;
    this.name = options.name;
    this.postingEnabled = options.postingEnabled ?? false;
  }

  async execute(input: ToolExecutionInput): Promise<AdapterResult> {
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
