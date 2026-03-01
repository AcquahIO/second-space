import OpenAI from "openai";
import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";

export interface OpenAIAdapterOptions {
  id: string;
  name: string;
  apiKey: string;
  model?: string;
}

export class OpenAIAdapter implements ToolBinding {
  id: string;
  name: string;
  provider = "openai";
  executionMode: ExecutionMode = "REAL";

  private client: OpenAI;
  private model: string;

  constructor(options: OpenAIAdapterOptions) {
    this.id = options.id;
    this.name = options.name;
    this.model = options.model ?? "gpt-4.1-mini";
    this.client = new OpenAI({ apiKey: options.apiKey });
  }

  async execute(input: ToolExecutionInput): Promise<AdapterResult> {
    try {
      const customSystemInstruction =
        typeof input.context?.systemInstruction === "string" && input.context.systemInstruction.trim()
          ? input.context.systemInstruction.trim()
          : null;

      const response = await this.client.responses.create({
        model: this.model,
        input: [
          {
            role: "system",
            content:
              customSystemInstruction ??
              "You are a specialist worker agent executing an assigned business task. Return concise completion output."
          },
          {
            role: "user",
            content: input.prompt
          }
        ]
      });

      return {
        ok: true,
        output: response.output_text,
        raw: response
      };
    } catch (error) {
      return {
        ok: false,
        output: "",
        error: error instanceof Error ? error.message : "Unknown OpenAI adapter error"
      };
    }
  }
}
