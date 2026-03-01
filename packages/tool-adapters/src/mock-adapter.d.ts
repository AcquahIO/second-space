import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";
export interface MockAdapterOptions {
    id: string;
    name: string;
    provider?: string;
    latencyMs?: number;
}
export declare class MockAdapter implements ToolBinding {
    id: string;
    name: string;
    provider: string;
    executionMode: ExecutionMode;
    private latencyMs;
    constructor(options: MockAdapterOptions);
    execute(input: ToolExecutionInput): Promise<AdapterResult>;
}
