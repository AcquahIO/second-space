import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";
export interface InternalReadAdapterOptions {
    id: string;
    name: string;
    provider: string;
}
export declare class InternalReadAdapter implements ToolBinding {
    id: string;
    name: string;
    provider: string;
    executionMode: ExecutionMode;
    constructor(options: InternalReadAdapterOptions);
    execute(input: ToolExecutionInput): Promise<AdapterResult>;
}
