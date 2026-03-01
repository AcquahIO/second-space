import OpenAI, { toFile } from "openai";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";

export async function transcribeAudio(buffer: Buffer, mimeType = "audio/webm") {
  const apiKey = getRuntimeEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return {
      text: "(No OPENAI_API_KEY configured. Voice input disabled.)"
    };
  }

  const client = new OpenAI({ apiKey });
  const file = await toFile(buffer, "voice-input.webm", { type: mimeType });

  const transcript = await client.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe"
  });

  return {
    text: transcript.text
  };
}
