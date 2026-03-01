import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";

export interface InternalReadAdapterOptions {
  id: string;
  name: string;
  provider: string;
}

export class InternalReadAdapter implements ToolBinding {
  id: string;
  name: string;
  provider: string;
  executionMode: ExecutionMode = "MOCK";

  constructor(options: InternalReadAdapterOptions) {
    this.id = options.id;
    this.name = options.name;
    this.provider = options.provider;
  }

  async execute(input: ToolExecutionInput): Promise<AdapterResult> {
    return {
      ok: true,
      output: `[${this.provider.toUpperCase()}] Internal read-only tool executed for task ${input.taskId}. Prompt excerpt: ${input.prompt.slice(0, 220)}`
    };
  }
}
