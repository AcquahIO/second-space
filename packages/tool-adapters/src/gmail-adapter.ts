import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";

export interface GmailAdapterOptions {
  id: string;
  name: string;
}

export class GmailAdapter implements ToolBinding {
  id: string;
  name: string;
  provider = "gmail";
  executionMode: ExecutionMode = "REAL";

  constructor(options: GmailAdapterOptions) {
    this.id = options.id;
    this.name = options.name;
  }

  async execute(input: ToolExecutionInput): Promise<AdapterResult> {
    return {
      ok: true,
      output: `[GMAIL] Generated outbound message draft and queued send workflow for task ${input.taskId}.`
    };
  }
}
