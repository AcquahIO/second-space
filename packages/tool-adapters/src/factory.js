import { MockAdapter } from "./mock-adapter";
import { OpenAIAdapter } from "./openai-adapter";
import { GitHubAdapter } from "./github-adapter";
import { LinkedInAdapter } from "./linkedin-adapter";
import { GmailAdapter } from "./gmail-adapter";
import { InternalReadAdapter } from "./internal-read-adapter";
export function createToolAdapter(input) {
    const provider = input.provider.toLowerCase();
    const mode = input.executionMode;
    if (provider === "openai" && mode === "REAL") {
        const apiKey = String(input.config?.apiKey ?? process.env.OPENAI_API_KEY ?? "");
        const model = String(input.config?.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini");
        if (!apiKey) {
            return new MockAdapter({
                id: input.toolId,
                name: `${input.toolName} (fallback mock)`,
                provider: "openai-missing-key"
            });
        }
        return new OpenAIAdapter({
            id: input.toolId,
            name: input.toolName,
            apiKey,
            model
        });
    }
    if (provider === "github") {
        return new GitHubAdapter({
            id: input.toolId,
            name: input.toolName,
            defaultBranch: String(input.config?.defaultBranch ?? "main")
        });
    }
    if (provider === "linkedin") {
        return new LinkedInAdapter({
            id: input.toolId,
            name: input.toolName,
            postingEnabled: Boolean(input.config?.postingEnabled)
        });
    }
    if (provider === "gmail") {
        return new GmailAdapter({
            id: input.toolId,
            name: input.toolName
        });
    }
    const internalReadProviders = new Set([
        "codebase-read",
        "architecture-store",
        "ci-logs",
        "cloud-audit",
        "staging-checks",
        "error-logs",
        "browser-qa",
        "auth-logs",
        "db-audit",
        "secret-metadata",
        "runbook-knowledge",
        "mission-tracker",
        "approval-queue",
        "activity-feed",
        "scheduler"
    ]);
    if (internalReadProviders.has(provider)) {
        return new InternalReadAdapter({
            id: input.toolId,
            name: input.toolName,
            provider
        });
    }
    return new MockAdapter({
        id: input.toolId,
        name: input.toolName,
        provider
    });
}
