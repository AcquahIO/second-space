import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";

export interface MockAdapterOptions {
  id: string;
  name: string;
  provider?: string;
  latencyMs?: number;
}

export class MockAdapter implements ToolBinding {
  id: string;
  name: string;
  provider: string;
  executionMode: ExecutionMode = "MOCK";
  private latencyMs: number;

  constructor(options: MockAdapterOptions) {
    this.id = options.id;
    this.name = options.name;
    this.provider = options.provider ?? "mock";
    this.latencyMs = options.latencyMs ?? 500;
  }

  async execute(input: ToolExecutionInput): Promise<AdapterResult> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    return {
      ok: true,
      output: `[MOCK:${this.provider}] Completed task ${input.taskId} for agent ${input.agentId}. Prompt summary: ${input.prompt.slice(0, 120)}`
    };
  }
}
