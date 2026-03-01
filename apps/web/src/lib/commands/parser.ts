import type { CommandMode, ProposedTask, SpecialistRole } from "@second-space/shared-types";

export interface ParsedCommand {
  intent: string;
  mode: CommandMode;
  proposedTasks: ProposedTask[];
  clarifyingQuestions: string[];
}

const EXTERNAL_ACTION_PATTERN = /(send|email|post|publish|commit|push|deploy|message|notify)/i;
const HIGH_RISK_PATTERN = /(delete|shutdown|production|billing|payment|contract|legal)/i;
const REVIEW_MODE_PATTERN = /\b(review|retrospective|postmortem|lessons learned|summary|summarize|debrief)\b/i;
const EXPLORE_MODE_PATTERN = /\b(explore|brainstorm|ideate|feasibility|options|discover|research)\b/i;
const PLAN_MODE_PATTERN = /\b(plan|roadmap|strategy|milestone|scope|spec|outline)\b/i;
const EXECUTE_HINT_PATTERN = /\b(run|execute|ship|build|fix|implement|deploy|launch|deliver|do it)\b/i;
const GOAL_VERB_PATTERN = /\b(build|create|ship|launch|fix|draft|prepare|improve|audit|analyze|design|implement|write|deploy|test|run)\b/i;
const CONTEXT_PATTERN = /\bfor\b|\bwith\b|\bon\b|\bto\b/i;
const TIME_PATTERN = /\b(today|tomorrow|this week|this month|by\s+\w+|deadline|due|asap|priority|urgent)\b/i;

function hasKeyword(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export function inferCommandMode(rawText: string): CommandMode {
  const cleaned = rawText.trim();

  if (!cleaned) {
    return "explore";
  }

  if (REVIEW_MODE_PATTERN.test(cleaned)) {
    return "review";
  }

  if (EXPLORE_MODE_PATTERN.test(cleaned)) {
    return "explore";
  }

  if (PLAN_MODE_PATTERN.test(cleaned) && !EXECUTE_HINT_PATTERN.test(cleaned)) {
    return "plan";
  }

  return "execute";
}

function buildClarifyingQuestions(cleaned: string): string[] {
  const questions: string[] = [];
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (!GOAL_VERB_PATTERN.test(cleaned) || words.length < 4) {
    questions.push("What concrete outcome do you want the PM to deliver first?");
  }

  if (!CONTEXT_PATTERN.test(cleaned)) {
    questions.push("Which product, feature, or customer segment should this mission focus on?");
  }

  if (!TIME_PATTERN.test(cleaned)) {
    questions.push("What priority or timeline should PM optimize for?");
  }

  return questions.slice(0, 3);
}

function determineSpecialists(cleaned: string): SpecialistRole[] {
  const specialists = new Set<SpecialistRole>();

  if (hasKeyword(cleaned, /(build|code|release|deploy|fix|bug|ship|feature|repository|github)/i)) {
    specialists.add("TECH_LEAD");
    specialists.add("SOFTWARE_ENGINEER");
    specialists.add("QA_TESTER");
    specialists.add("DEVOPS_ENGINEER");
    specialists.add("SECURITY_AGENT");
  }

  if (hasKeyword(cleaned, /(campaign|content|social|linkedin|brand|marketing|growth|launch)/i)) {
    specialists.add("CONTENT_AGENT");
    specialists.add("MARKETING_AGENT");
  }

  if (hasKeyword(cleaned, /(finance|budget|invoice|billing|revenue|cost|runway)/i)) {
    specialists.add("FINANCE_AGENT");
  }

  if (hasKeyword(cleaned, /(customer|support|ticket|complaint|churn|onboard customer)/i)) {
    specialists.add("CUSTOMER_SUPPORT_AGENT");
  }

  if (hasKeyword(cleaned, /(operations|logistics|process|workflow|vendor|compliance)/i)) {
    specialists.add("OPERATIONS_LOGISTICS_AGENT");
  }

  if (hasKeyword(cleaned, /(security|threat|cve|vulnerability|oauth|secret|compliance|risk)/i)) {
    specialists.add("SECURITY_AGENT");
  }

  if (!specialists.size) {
    specialists.add("TECH_LEAD");
    specialists.add("SECURITY_AGENT");
  }

  return Array.from(specialists);
}

function preferredToolForSpecialist(role: SpecialistRole): string {
  if (["TECH_LEAD", "SOFTWARE_ENGINEER", "QA_TESTER", "DEVOPS_ENGINEER", "SECURITY_AGENT"].includes(role)) {
    return "GitHub Workspace";
  }

  if (["CONTENT_AGENT", "MARKETING_AGENT"].includes(role)) {
    return "LinkedIn Workspace";
  }

  if (["FINANCE_AGENT", "CUSTOMER_SUPPORT_AGENT", "OPERATIONS_LOGISTICS_AGENT", "PROJECT_MANAGER"].includes(role)) {
    return "Gmail Workspace";
  }

  return "OpenAI Core";
}

function planModeTasks(intent: string, cleaned: string): ProposedTask[] {
  return [
    {
      title: "Explore objective framing and constraints",
      description: `PM identifies goals, constraints, and unknowns for: ${intent}`,
      assigneeSpecialistRole: "PROJECT_MANAGER",
      assigneeRole: "DIRECTOR",
      requiresApproval: false,
      externalAction: false,
      toolName: "OpenAI Core",
      metadata: {
        phase: "planning",
        sourceText: cleaned
      }
    },
    {
      title: "Produce structured execution plan (no launch)",
      description: "Generate milestones, dependencies, risks, and role assignments only.",
      assigneeSpecialistRole: "TECH_LEAD",
      assigneeRole: "MANAGER",
      requiresApproval: false,
      externalAction: false,
      toolName: "OpenAI Core",
      parentIndex: 0,
      metadata: {
        phase: "planning"
      }
    }
  ];
}

function exploreModeTasks(cleaned: string, clarifyingQuestions: string[]): ProposedTask[] {
  const clarificationText = clarifyingQuestions.length
    ? ` Clarifying questions: ${clarifyingQuestions.join(" ")}`
    : "";

  return [
    {
      title: "Strategic exploration",
      description: `PM explores options, asks clarifying questions, and tests feasibility for: ${cleaned}.${clarificationText}`,
      assigneeSpecialistRole: "PROJECT_MANAGER",
      assigneeRole: "DIRECTOR",
      requiresApproval: false,
      externalAction: false,
      toolName: "OpenAI Core",
      metadata: {
        phase: "explore",
        clarifyingQuestions
      }
    }
  ];
}

function reviewModeTasks(intent: string): ProposedTask[] {
  return [
    {
      title: "End-of-mission review",
      description: `Summarize outcomes, misses, lessons learned, and recommended next actions for: ${intent}`,
      assigneeSpecialistRole: "PROJECT_MANAGER",
      assigneeRole: "DIRECTOR",
      requiresApproval: false,
      externalAction: false,
      toolName: "OpenAI Core",
      metadata: {
        phase: "review"
      }
    }
  ];
}

function executeModeTasks(intent: string, cleaned: string, requiresApproval: boolean): ProposedTask[] {
  const specialists = determineSpecialists(cleaned);
  const proposedTasks: ProposedTask[] = [
    {
      title: "Frame objective and execution constraints",
      description: `Project manager decomposes request: ${cleaned}`,
      assigneeSpecialistRole: "PROJECT_MANAGER",
      assigneeRole: "DIRECTOR",
      requiresApproval: false,
      externalAction: false,
      toolName: "OpenAI Core"
    }
  ];

  const planIndex = proposedTasks.length;
  proposedTasks.push({
    title: "Generate cross-team execution plan",
    description: "Tech lead prepares milestones, dependencies, and role assignments across specialists.",
    assigneeSpecialistRole: "TECH_LEAD",
    assigneeRole: "MANAGER",
    requiresApproval: false,
    externalAction: false,
    toolName: "OpenAI Core",
    parentIndex: 0
  });

  for (const specialist of specialists) {
    const externalAction =
      requiresApproval &&
      [
        "CONTENT_AGENT",
        "MARKETING_AGENT",
        "SOFTWARE_ENGINEER",
        "DEVOPS_ENGINEER",
        "FINANCE_AGENT",
        "CUSTOMER_SUPPORT_AGENT",
        "OPERATIONS_LOGISTICS_AGENT"
      ].includes(specialist);

    proposedTasks.push({
      title: `${specialist.replace(/_/g, " ")} deliverable`,
      description: `${specialist.replace(/_/g, " ")} executes scoped workstream for intent: ${intent}`,
      assigneeSpecialistRole: specialist,
      assigneeRole: specialist === "TECH_LEAD" ? "MANAGER" : "SPECIALIST",
      requiresApproval: externalAction,
      externalAction,
      toolName: preferredToolForSpecialist(specialist),
      parentIndex: planIndex,
      metadata: {
        specialist,
        phase: "execute"
      }
    });
  }

  const securityReviewNeeded = requiresApproval || specialists.some((role) => role === "SECURITY_AGENT");
  if (securityReviewNeeded) {
    proposedTasks.push({
      title: "Security precheck for external-write risk",
      description: "Security agent validates approval gates, permissions, and policy constraints before execution.",
      assigneeSpecialistRole: "SECURITY_AGENT",
      assigneeRole: "SPECIALIST",
      requiresApproval: false,
      externalAction: false,
      toolName: "OpenAI Core",
      parentIndex: planIndex,
      metadata: {
        specialist: "SECURITY_AGENT",
        phase: "execute",
        securityPrecheck: true
      }
    });
  }

  proposedTasks.push({
    title: "Consolidate output and launch-ready handoff",
    description: "Project manager validates quality, summarizes risks, and prepares final output for operator review.",
    assigneeSpecialistRole: "PROJECT_MANAGER",
    assigneeRole: "DIRECTOR",
    requiresApproval: false,
    externalAction: false,
    toolName: "OpenAI Core",
    parentIndex: planIndex
  });

  return proposedTasks;
}

export function parseCommandText(rawText: string, mode?: CommandMode): ParsedCommand {
  const cleaned = rawText.trim();
  const intent = cleaned.split(/[.!?]/)[0]?.slice(0, 140) || "Coordinate agent execution";
  const requiresApproval = EXTERNAL_ACTION_PATTERN.test(cleaned) || HIGH_RISK_PATTERN.test(cleaned);
  const resolvedMode = mode ?? inferCommandMode(cleaned);
  const clarifyingQuestions = buildClarifyingQuestions(cleaned);

  if (resolvedMode === "execute" && cleaned.split(/\s+/).filter(Boolean).length < 5) {
    return {
      intent,
      mode: "explore",
      proposedTasks: exploreModeTasks(cleaned, clarifyingQuestions),
      clarifyingQuestions
    };
  }

  if (resolvedMode === "explore") {
    return { intent, mode: "explore", proposedTasks: exploreModeTasks(cleaned, clarifyingQuestions), clarifyingQuestions };
  }

  if (resolvedMode === "plan") {
    return { intent, mode: "plan", proposedTasks: planModeTasks(intent, cleaned), clarifyingQuestions };
  }

  if (resolvedMode === "review") {
    return { intent, mode: "review", proposedTasks: reviewModeTasks(intent), clarifyingQuestions };
  }

  return {
    intent,
    mode: "execute",
    proposedTasks: executeModeTasks(intent, cleaned, requiresApproval),
    clarifyingQuestions
  };
}
