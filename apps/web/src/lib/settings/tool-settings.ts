import { prisma } from "@/lib/db/prisma";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";

export async function getToolSettings(workspaceId: string) {
  const openaiTool = await prisma.tool.findFirst({ where: { workspaceId, provider: "openai" } });
  const hasApiKey = Boolean((openaiTool?.config as Record<string, unknown> | null)?.apiKey || getRuntimeEnv("OPENAI_API_KEY"));

  return {
    openai: {
      configured: Boolean(openaiTool),
      executionMode: hasApiKey ? "REAL" : openaiTool?.executionMode ?? "MOCK",
      model:
        (openaiTool?.config as Record<string, unknown> | null)?.model ??
        getRuntimeEnv("OPENAI_MODEL") ??
        "gpt-4.1-mini",
      hasApiKey
    }
  };
}

export async function updateOpenAITool(workspaceId: string, apiKey: string | null, model: string) {
  const existing = await prisma.tool.findFirst({ where: { workspaceId, provider: "openai" } });
  const existingConfig = (existing?.config as Record<string, unknown> | null) ?? {};
  const resolvedKey = apiKey || String(existingConfig.apiKey ?? getRuntimeEnv("OPENAI_API_KEY") ?? "");

  if (!resolvedKey) {
    throw new Error("apiKey is required");
  }

  const nextConfig = {
    ...existingConfig,
    apiKey: resolvedKey,
    model
  };

  const tool = await prisma.tool.upsert({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: "openai"
      }
    },
    update: {
      provider: "openai",
      name: "OpenAI Core",
      executionMode: "REAL",
      config: nextConfig
    },
    create: {
      workspaceId,
      provider: "openai",
      name: "OpenAI Core",
      executionMode: "REAL",
      config: nextConfig
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      action: "OPENAI_TOOL_UPDATED",
      target: tool.id,
      metadata: {
        model
      }
    }
  });

  return {
    executionMode: tool.executionMode,
    model,
    hasApiKey: true
  };
}
