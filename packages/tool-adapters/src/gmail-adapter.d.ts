import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";
export interface GmailAdapterOptions {
    id: string;
    name: string;
}
export declare class GmailAdapter implements ToolBinding {
    id: string;
    name: string;
    provider: string;
    executionMode: ExecutionMode;
    constructor(options: GmailAdapterOptions);
    execute(input: ToolExecutionInput): Promise<AdapterResult>;
}
