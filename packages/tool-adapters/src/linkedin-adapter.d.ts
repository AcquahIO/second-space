import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";
export interface LinkedInAdapterOptions {
    id: string;
    name: string;
    postingEnabled?: boolean;
}
export declare class LinkedInAdapter implements ToolBinding {
    id: string;
    name: string;
    provider: string;
    executionMode: ExecutionMode;
    private postingEnabled;
    constructor(options: LinkedInAdapterOptions);
    execute(input: ToolExecutionInput): Promise<AdapterResult>;
}
