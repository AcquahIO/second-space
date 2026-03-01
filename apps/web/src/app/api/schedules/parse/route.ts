import { NextRequest, NextResponse } from "next/server";
import { parseNaturalLanguageSchedule } from "@/lib/scheduling/natural-language";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const text = String(body.text ?? "").trim();
    const timezone = String(body.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));

    if (!text) {
      return jsonError("text is required", 400);
    }

    const parsed = parseNaturalLanguageSchedule(text, timezone);
    return NextResponse.json(parsed);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not parse schedule", 500);
  }
}
