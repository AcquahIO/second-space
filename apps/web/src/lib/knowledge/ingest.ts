import OpenAI from "openai";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";

interface ChunkDefinition {
  chunkIndex: number;
  content: string;
}

let openAIClient: OpenAI | null | undefined;

function getOpenAIClient(): OpenAI | null {
  if (openAIClient !== undefined) {
    return openAIClient;
  }

  const apiKey = getRuntimeEnv("OPENAI_API_KEY");
  if (!apiKey) {
    openAIClient = null;
    return openAIClient;
  }

  openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}

export function splitIntoChunks(text: string, chunkSize = 1200, overlap = 120): ChunkDefinition[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const chunks: ChunkDefinition[] = [];
  let index = 0;
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize);
    chunks.push({
      chunkIndex: index,
      content: normalized.slice(cursor, end)
    });

    index += 1;
    if (end === normalized.length) {
      break;
    }

    cursor = Math.max(0, end - overlap);
  }

  return chunks;
}

export async function embedChunk(content: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  try {
    const response = await client.embeddings.create({
      model: getRuntimeEnv("OPENAI_EMBED_MODEL") ?? "text-embedding-3-small",
      input: content
    });

    return response.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export async function createChunkRecords(content: string) {
  const chunks = splitIntoChunks(content);

  return Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await embedChunk(chunk.content);
      return {
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding
      };
    })
  );
}
