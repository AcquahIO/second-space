import type { ToolBinding } from "@second-space/shared-types";
interface AdapterFactoryInput {
    toolId: string;
    toolName: string;
    provider: string;
    executionMode: "REAL" | "MOCK";
    config?: Record<string, unknown> | null;
}
export declare function createToolAdapter(input: AdapterFactoryInput): ToolBinding;
export {};
