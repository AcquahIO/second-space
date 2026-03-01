import type { AdapterResult, ExecutionMode, ToolBinding, ToolExecutionInput } from "@second-space/shared-types";
export interface GitHubAdapterOptions {
    id: string;
    name: string;
    defaultBranch?: string;
}
export declare class GitHubAdapter implements ToolBinding {
    id: string;
    name: string;
    provider: string;
    executionMode: ExecutionMode;
    private defaultBranch;
    constructor(options: GitHubAdapterOptions);
    execute(input: ToolExecutionInput): Promise<AdapterResult>;
}
