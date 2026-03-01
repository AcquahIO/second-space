import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";
import {
  AGENT_CONTRACTS,
  AGENT_TOOL_MATRIX,
  DEFAULT_INTEGRATION_PERMISSION_MATRIX,
  TOOL_BLUEPRINTS,
  buildMinimalSoulIdentityMemory,
  type ContractToolProvider,
  type SpecialistRole
} from "@second-space/shared-types";

interface AgentTemplate {
  specialistRole: SpecialistRole;
  name: string;
  role: "DIRECTOR" | "MANAGER" | "SPECIALIST";
  managerRole?: SpecialistRole;
  specialty: string;
}

const AGENT_CREATION_ORDER: SpecialistRole[] = [
  "PROJECT_MANAGER",
  "TECH_LEAD",
  "SOFTWARE_ENGINEER",
  "QA_TESTER",
  "DEVOPS_ENGINEER",
  "SECURITY_AGENT",
  "CONTENT_AGENT",
  "MARKETING_AGENT",
  "FINANCE_AGENT",
  "CUSTOMER_SUPPORT_AGENT",
  "OPERATIONS_LOGISTICS_AGENT"
];

const AGENT_TEMPLATES: AgentTemplate[] = AGENT_CREATION_ORDER.map((role) => {
  if (role === "PROJECT_MANAGER") {
    return {
      specialistRole: role,
      name: "Parker Project",
      role: "DIRECTOR",
      specialty: AGENT_CONTRACTS[role].mission
    };
  }

  if (role === "TECH_LEAD") {
    return {
      specialistRole: role,
      name: "Taylor TechLead",
      role: "MANAGER",
      managerRole: "PROJECT_MANAGER",
      specialty: AGENT_CONTRACTS[role].mission
    };
  }

  const names: Record<Exclude<SpecialistRole, "PROJECT_MANAGER" | "TECH_LEAD">, string> = {
    SOFTWARE_ENGINEER: "Sage Engineer",
    QA_TESTER: "Quinn QA",
    DEVOPS_ENGINEER: "Devon DevOps",
    SECURITY_AGENT: "Sierra Security",
    CONTENT_AGENT: "Casey Content",
    MARKETING_AGENT: "Morgan Marketing",
    FINANCE_AGENT: "Finley Finance",
    CUSTOMER_SUPPORT_AGENT: "Sky Support",
    OPERATIONS_LOGISTICS_AGENT: "Oak Operations"
  };

  return {
    specialistRole: role,
    name: names[role as Exclude<SpecialistRole, "PROJECT_MANAGER" | "TECH_LEAD">],
    role: "SPECIALIST",
    managerRole: role === "SOFTWARE_ENGINEER" || role === "QA_TESTER" || role === "DEVOPS_ENGINEER" ? "TECH_LEAD" : "PROJECT_MANAGER",
    specialty: AGENT_CONTRACTS[role].mission
  };
});

function nextMondayAtNine(now = new Date()): Date {
  const date = new Date(now);
  const day = date.getDay();
  const daysUntilMonday = (1 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(9, 0, 0, 0);
  return date;
}

function defaultToolConfig(provider: ContractToolProvider): Record<string, unknown> {
  if (provider === "openai") {
    return {
      model: getRuntimeEnv("OPENAI_MODEL") ?? "gpt-4.1-mini"
    };
  }

  if (provider === "github") {
    return {
      defaultBranch: "main",
      readOnly: false
    };
  }

  if (provider === "linkedin") {
    return {
      postingEnabled: false
    };
  }

  return { readOnly: true };
}

export async function bootstrapWorkspace(workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const createdAgentsByRole = new Map<SpecialistRole, string>();

    for (const template of AGENT_TEMPLATES) {
      const managerId = template.managerRole ? createdAgentsByRole.get(template.managerRole) ?? null : null;

      const agent = await tx.agent.create({
        data: {
          workspaceId,
          name: template.name,
          role: template.role,
          specialistRole: template.specialistRole,
          specialty: template.specialty,
          managerId
        }
      });

      createdAgentsByRole.set(template.specialistRole, agent.id);

      await tx.agentStats.create({
        data: {
          workspaceId,
          agentId: agent.id,
          xp: 0,
          level: 1,
          mood: "NEUTRAL",
          badges: [],
          streak: 0
        }
      });

      await tx.simPosition.create({
        data: {
          workspaceId,
          agentId: agent.id,
          x: 100,
          y: 100,
          state: "IDLE"
        }
      });

      await tx.agentMemory.create({
        data: {
          workspaceId,
          agentId: agent.id,
          content: buildMinimalSoulIdentityMemory(template.specialistRole)
        }
      });
    }

    const createdToolsByProvider = new Map<string, string>();

    for (const toolBlueprint of TOOL_BLUEPRINTS) {
      const tool = await tx.tool.create({
        data: {
          workspaceId,
          name: toolBlueprint.name,
          provider: toolBlueprint.provider,
          executionMode:
            toolBlueprint.provider === "openai"
              ? getRuntimeEnv("OPENAI_API_KEY")
                ? "REAL"
                : "MOCK"
              : toolBlueprint.executionMode,
          config: defaultToolConfig(toolBlueprint.provider) as Prisma.InputJsonValue
        }
      });

      createdToolsByProvider.set(toolBlueprint.provider, tool.id);
    }

    const agents = await tx.agent.findMany({ where: { workspaceId } });

    for (const agent of agents) {
      const providers = AGENT_TOOL_MATRIX[agent.specialistRole as SpecialistRole] ?? ["openai"];

      for (const provider of providers) {
        const toolId = createdToolsByProvider.get(provider);
        if (!toolId) {
          continue;
        }

        await tx.agentTool.create({
          data: {
            agentId: agent.id,
            toolId
          }
        });
      }
    }

    await tx.workspaceIntegration.createMany({
      data: [
        {
          workspaceId,
          provider: "GITHUB",
          authStatus: "DISCONNECTED",
          capabilities: ["READ", "WRITE", "COMMIT", "PUSH"]
        },
        {
          workspaceId,
          provider: "LINKEDIN",
          authStatus: "DISCONNECTED",
          capabilities: ["READ", "POST"]
        },
        {
          workspaceId,
          provider: "GMAIL",
          authStatus: "DISCONNECTED",
          capabilities: ["READ", "SEND"]
        }
      ]
    });

    const integrations = await tx.workspaceIntegration.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true
      }
    });

    const integrationByProvider = new Map(integrations.map((integration) => [integration.provider, integration.id]));

    for (const agent of agents) {
      const matrix = DEFAULT_INTEGRATION_PERMISSION_MATRIX[agent.specialistRole as SpecialistRole] ?? {};
      for (const provider of ["GITHUB", "LINKEDIN", "GMAIL"] as const) {
        const capabilities = matrix[provider];
        const workspaceIntegrationId = integrationByProvider.get(provider);
        if (!workspaceIntegrationId || !capabilities?.length) {
          continue;
        }

        await tx.agentIntegrationPermission.create({
          data: {
            workspaceIntegrationId,
            agentId: agent.id,
            capabilities
          }
        });
      }
    }

    const projectManagerId = createdAgentsByRole.get("PROJECT_MANAGER");
    if (projectManagerId) {
      await tx.schedule.create({
        data: {
          workspaceId,
          leadAgentId: projectManagerId,
          name: "Weekly Reflection: Contract Evolution",
          prompt:
            "Analyze mission outcomes and memory events for PM and Security. Propose contract refinements only. Do not execute external writes.",
          naturalLanguage: "every monday at 9am",
          recurrence: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0",
          timezone: "UTC",
          enabled: true,
          nextRunAt: nextMondayAtNine(),
          metadata: {
            type: "LEARNING_REFLECTION",
            proposalMode: "PROPOSE_ONLY",
            minWorkspaceAgeDays: 14,
            minMemoryEvents: 25
          }
        }
      });
    }

    await tx.workspaceOnboardingStep.upsert({
      where: {
        workspaceId_step: {
          workspaceId,
          step: "AGENTS_HIRED"
        }
      },
      update: {
        completedAt: new Date()
      },
      create: {
        workspaceId,
        step: "AGENTS_HIRED"
      }
    });
  });
}
