import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";
import { buildWorkspaceScene } from "@/lib/presentation/workspace-scene";
import { parseSceneInclude, parseSceneView } from "@/lib/presentation/workspace-scene-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const url = new URL(request.url);
    const selectedAgentId = url.searchParams.get("selectedAgentId");
    const rawIncludes = url.searchParams.getAll("include");

    const scene = await buildWorkspaceScene(session.workspaceId, {
      view: parseSceneView(url.searchParams.get("view")),
      selectedAgentId: selectedAgentId?.trim() ? selectedAgentId.trim() : null,
      include: parseSceneInclude(rawIncludes.join(","))
    });

    return NextResponse.json(scene);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not build workspace scene", 500);
  }
}
