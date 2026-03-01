import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSessionFromRequest, mockAssertWorkspaceSubscriptionActive, mockCreateWorkspacePresentationToken } = vi.hoisted(
  () => ({
    mockGetSessionFromRequest: vi.fn(),
    mockAssertWorkspaceSubscriptionActive: vi.fn(),
    mockCreateWorkspacePresentationToken: vi.fn()
  })
);

vi.mock("@/lib/auth/server-auth", () => ({
  getSessionFromRequest: mockGetSessionFromRequest,
  assertWorkspaceSubscriptionActive: mockAssertWorkspaceSubscriptionActive,
  unauthorizedJson: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
}));

vi.mock("@/lib/auth/session", () => ({
  createWorkspacePresentationToken: mockCreateWorkspacePresentationToken
}));

import { POST } from "./route";

describe("POST /api/presentation/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.WORKER_PORT;
  });

  it("returns unauthorized when no session is present", async () => {
    mockGetSessionFromRequest.mockReturnValue(null);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/presentation/session", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockCreateWorkspacePresentationToken).not.toHaveBeenCalled();
  });

  it("creates a dashboard-scoped presentation token by default", async () => {
    mockGetSessionFromRequest.mockReturnValue({
      sub: "user_123",
      workspaceId: "ws_123"
    });
    mockCreateWorkspacePresentationToken.mockReturnValue({
      token: "presentation-token",
      expiresAt: "2026-03-01T12:05:00.000Z"
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/presentation/session", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(mockAssertWorkspaceSubscriptionActive).toHaveBeenCalledWith("ws_123");
    expect(mockCreateWorkspacePresentationToken).toHaveBeenCalledWith({
      sub: "user_123",
      workspaceId: "ws_123",
      channel: "dashboard"
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      websocketUrl: "ws://localhost:4001",
      presentationToken: "presentation-token",
      expiresAt: "2026-03-01T12:05:00.000Z",
      channel: "dashboard"
    });
  });

  it("uses the requested channel and explicit websocket url when provided", async () => {
    process.env.NEXT_PUBLIC_WS_URL = "wss://realtime.secondspace.test";

    mockGetSessionFromRequest.mockReturnValue({
      sub: "user_123",
      workspaceId: "ws_123"
    });
    mockCreateWorkspacePresentationToken.mockReturnValue({
      token: "presentation-token",
      expiresAt: "2026-03-01T12:05:00.000Z"
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/presentation/session", {
        method: "POST",
        body: JSON.stringify({ channel: "presentation" })
      })
    );

    expect(mockCreateWorkspacePresentationToken).toHaveBeenCalledWith({
      sub: "user_123",
      workspaceId: "ws_123",
      channel: "presentation"
    });
    await expect(response.json()).resolves.toEqual({
      websocketUrl: "wss://realtime.secondspace.test",
      presentationToken: "presentation-token",
      expiresAt: "2026-03-01T12:05:00.000Z",
      channel: "presentation"
    });
  });
});
