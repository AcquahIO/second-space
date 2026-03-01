import { describe, expect, it } from "vitest";
import { buildWorkspaceSetupGuidance } from "./access-guidance";

const disconnectedSetup = {
  github: {
    connected: false,
    repoFullName: null,
    defaultBranch: null,
    accountLabel: null,
    authStatus: "DISCONNECTED" as const
  },
  gmail: {
    connected: false,
    accountLabel: null,
    authStatus: "DISCONNECTED" as const
  },
  linkedin: {
    connected: false,
    accountLabel: null,
    authStatus: "DISCONNECTED" as const
  }
};

describe("buildWorkspaceSetupGuidance", () => {
  it("suggests GitHub when code review needs source access", () => {
    const result = buildWorkspaceSetupGuidance("I want to review my code", disconnectedSetup);

    expect(result).toContain("GitHub is not connected");
  });

  it("suggests Gmail when inbox or send work needs workspace email access", () => {
    const result = buildWorkspaceSetupGuidance("Send this email to the customer", disconnectedSetup);

    expect(result).toContain("Gmail is not connected");
  });

  it("suggests LinkedIn when posting needs workspace LinkedIn access", () => {
    const result = buildWorkspaceSetupGuidance("Post this on LinkedIn", disconnectedSetup);

    expect(result).toContain("LinkedIn is not connected");
  });
});
