import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";
export interface OpenAIAdapterOptions {
    id: string;
    name: string;
    apiKey: string;
    model?: string;
}
export declare class OpenAIAdapter implements ToolBinding {
    id: string;
    name: string;
    provider: string;
    executionMode: ExecutionMode;
    private client;
    private model;
    constructor(options: OpenAIAdapterOptions);
    execute(input: ToolExecutionInput): Promise<AdapterResult>;
}
