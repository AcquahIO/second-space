import bcrypt from "bcryptjs";
import { PrismaClient, SpecialistRole } from "@prisma/client";
import {
  AGENT_CONTRACTS,
  AGENT_TOOL_MATRIX,
  DEFAULT_INTEGRATION_PERMISSION_MATRIX,
  TOOL_BLUEPRINTS,
  buildMinimalSoulIdentityMemory,
  type ContractToolProvider
} from "@second-space/shared-types";

const prisma = new PrismaClient();

const AGENT_SEED_ORDER: SpecialistRole[] = [
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

const AGENT_NAMES: Record<SpecialistRole, string> = {
  PROJECT_MANAGER: "Parker Project",
  TECH_LEAD: "Taylor TechLead",
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

function roleType(role: SpecialistRole): "DIRECTOR" | "MANAGER" | "SPECIALIST" {
  if (role === "PROJECT_MANAGER") {
    return "DIRECTOR";
  }

  if (role === "TECH_LEAD") {
    return "MANAGER";
  }

  return "SPECIALIST";
}

function managerRole(role: SpecialistRole): SpecialistRole | null {
  if (role === "PROJECT_MANAGER") {
    return null;
  }

  if (role === "TECH_LEAD") {
    return "PROJECT_MANAGER";
  }

  if (role === "SOFTWARE_ENGINEER" || role === "QA_TESTER" || role === "DEVOPS_ENGINEER") {
    return "TECH_LEAD";
  }

  return "PROJECT_MANAGER";
}

function nextMondayAtNine(now = new Date()): Date {
  const date = new Date(now);
  const day = date.getDay();
  const daysUntilMonday = (1 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(9, 0, 0, 0);
  return date;
}

function defaultToolConfig(provider: ContractToolProvider): Record<string, unknown> | null {
  if (provider === "openai") {
    return { model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini" };
  }

  if (provider === "github") {
    return { defaultBranch: "main", readOnly: false };
  }

  if (provider === "linkedin") {
    return { postingEnabled: false };
  }

  return { readOnly: true };
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "founder@secondspace.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme";
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(adminPassword, 10);

  const workspaceSlug = process.env.WORKSPACE_SLUG ?? "default-workspace";
  const workspaceName = process.env.WORKSPACE_NAME ?? "Second Space Workspace";

  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSlug },
    update: {
      name: workspaceName
    },
    create: {
      slug: workspaceSlug,
      name: workspaceName,
      onboardingState: "WORKSPACE_SETUP"
    }
  });

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      workspaceId: workspace.id,
      passwordHash: adminPasswordHash,
      role: "OWNER",
      isWorkspaceOwner: true
    },
    create: {
      workspaceId: workspace.id,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "OWNER",
      isWorkspaceOwner: true
    }
  });

  await prisma.workspaceSubscription.upsert({
    where: { workspaceId: workspace.id },
    update: {
      status: "TRIALING"
    },
    create: {
      workspaceId: workspace.id,
      status: "TRIALING",
      stripeCustomerId: process.env.STRIPE_CUSTOMER_ID ?? null,
      stripeSubscriptionId: process.env.STRIPE_SUBSCRIPTION_ID ?? null,
      stripePriceId: process.env.STRIPE_PRICE_ID ?? null
    }
  });

  const createdAgentsByRole = new Map<SpecialistRole, string>();

  for (const specialistRole of AGENT_SEED_ORDER) {
    const manager = managerRole(specialistRole);
    const managerId = manager ? createdAgentsByRole.get(manager) ?? null : null;
    const id = `agent-${specialistRole.toLowerCase()}`;
    const contract = AGENT_CONTRACTS[specialistRole];

    const agent = await prisma.agent.upsert({
      where: { id },
      update: {
        workspaceId: workspace.id,
        name: AGENT_NAMES[specialistRole],
        role: roleType(specialistRole),
        specialistRole,
        specialty: contract.mission,
        managerId
      },
      create: {
        id,
        workspaceId: workspace.id,
        name: AGENT_NAMES[specialistRole],
        role: roleType(specialistRole),
        specialistRole,
        specialty: contract.mission,
        managerId
      }
    });

    createdAgentsByRole.set(specialistRole, agent.id);

    await prisma.agentStats.upsert({
      where: { agentId: agent.id },
      update: {
        workspaceId: workspace.id
      },
      create: {
        workspaceId: workspace.id,
        agentId: agent.id,
        xp: 0,
        level: 1,
        mood: "NEUTRAL",
        badges: [],
        streak: 0
      }
    });

    await prisma.simPosition.upsert({
      where: { agentId: agent.id },
      update: {
        workspaceId: workspace.id,
        x: 100,
        y: 100,
        state: "IDLE"
      },
      create: {
        workspaceId: workspace.id,
        agentId: agent.id,
        x: 100,
        y: 100,
        state: "IDLE"
      }
    });

    await prisma.agentMemory.upsert({
      where: { id: `${agent.id}-memory-foundation` },
      update: {
        workspaceId: workspace.id,
        content: buildMinimalSoulIdentityMemory(specialistRole)
      },
      create: {
        id: `${agent.id}-memory-foundation`,
        workspaceId: workspace.id,
        agentId: agent.id,
        content: buildMinimalSoulIdentityMemory(specialistRole)
      }
    });
  }

  const allAgents = await prisma.agent.findMany({ where: { workspaceId: workspace.id } });

  const toolByProvider = new Map<string, string>();
  for (const toolBlueprint of TOOL_BLUEPRINTS) {
    const tool = await prisma.tool.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: workspace.id,
          provider: toolBlueprint.provider
        }
      },
      update: {
        name: toolBlueprint.name,
        executionMode:
          toolBlueprint.provider === "openai"
            ? process.env.OPENAI_API_KEY
              ? "REAL"
              : "MOCK"
            : toolBlueprint.executionMode,
        config: defaultToolConfig(toolBlueprint.provider)
      },
      create: {
        workspaceId: workspace.id,
        name: toolBlueprint.name,
        provider: toolBlueprint.provider,
        executionMode:
          toolBlueprint.provider === "openai"
            ? process.env.OPENAI_API_KEY
              ? "REAL"
              : "MOCK"
            : toolBlueprint.executionMode,
        config: defaultToolConfig(toolBlueprint.provider)
      }
    });

    toolByProvider.set(tool.provider, tool.id);
  }

  for (const agent of allAgents) {
    const providers = AGENT_TOOL_MATRIX[agent.specialistRole as SpecialistRole] ?? ["openai"];
    for (const provider of providers) {
      const toolId = toolByProvider.get(provider);
      if (!toolId) {
        continue;
      }

      await prisma.agentTool.upsert({
        where: {
          agentId_toolId: {
            agentId: agent.id,
            toolId
          }
        },
        update: {},
        create: {
          agentId: agent.id,
          toolId
        }
      });
    }
  }

  const integrations = [
    {
      provider: "GITHUB" as const,
      capabilities: ["READ", "WRITE", "COMMIT", "PUSH"] as const
    },
    {
      provider: "LINKEDIN" as const,
      capabilities: ["READ", "POST"] as const
    },
    {
      provider: "GMAIL" as const,
      capabilities: ["READ", "SEND"] as const
    }
  ];

  for (const integration of integrations) {
    await prisma.workspaceIntegration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: workspace.id,
          provider: integration.provider
        }
      },
      update: {
        authStatus: "DISCONNECTED",
        capabilities: [...integration.capabilities]
      },
      create: {
        workspaceId: workspace.id,
        provider: integration.provider,
        authStatus: "DISCONNECTED",
        capabilities: [...integration.capabilities]
      }
    });
  }

  const workspaceIntegrations = await prisma.workspaceIntegration.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, provider: true }
  });
  const integrationByProvider = new Map(workspaceIntegrations.map((integration) => [integration.provider, integration.id]));

  for (const agent of allAgents) {
    const matrix = DEFAULT_INTEGRATION_PERMISSION_MATRIX[agent.specialistRole as SpecialistRole] ?? {};
    for (const provider of ["GITHUB", "LINKEDIN", "GMAIL"] as const) {
      const capabilities = matrix[provider];
      const workspaceIntegrationId = integrationByProvider.get(provider);

      if (!workspaceIntegrationId || !capabilities?.length) {
        continue;
      }

      await prisma.agentIntegrationPermission.upsert({
        where: {
          workspaceIntegrationId_agentId: {
            workspaceIntegrationId,
            agentId: agent.id
          }
        },
        update: {
          capabilities
        },
        create: {
          workspaceIntegrationId,
          agentId: agent.id,
          capabilities
        }
      });
    }
  }

  const projectManagerId = createdAgentsByRole.get("PROJECT_MANAGER");
  if (projectManagerId) {
    const existingReflectionSchedule = await prisma.schedule.findFirst({
      where: {
        workspaceId: workspace.id,
        name: "Weekly Reflection: Contract Evolution"
      },
      select: { id: true }
    });

    if (existingReflectionSchedule) {
      await prisma.schedule.update({
        where: { id: existingReflectionSchedule.id },
        data: {
          leadAgentId: projectManagerId,
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
    } else {
      await prisma.schedule.create({
        data: {
          workspaceId: workspace.id,
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
  }

  await prisma.workspaceOnboardingStep.upsert({
    where: {
      workspaceId_step: {
        workspaceId: workspace.id,
        step: "WORKSPACE_SETUP"
      }
    },
    update: {
      completedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      step: "WORKSPACE_SETUP"
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "SEED_COMPLETE",
      target: workspace.slug,
      metadata: {
        agentCount: allAgents.length,
        toolCount: TOOL_BLUEPRINTS.length
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
