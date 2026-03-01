import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { transcribeAudio } from "@/lib/voice/transcribe";
import { jsonError } from "@/lib/utils/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof Blob)) {
      return jsonError("Audio blob is required", 400);
    }

    const arrayBuffer = await audio.arrayBuffer();
    const result = await transcribeAudio(Buffer.from(arrayBuffer), audio.type || "audio/webm");

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Transcription failed", 500);
  }
}
