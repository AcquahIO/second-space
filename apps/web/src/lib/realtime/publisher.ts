import Redis from "ioredis";
import type { RealtimeEvent, RealtimeEventName } from "@second-space/shared-types";
import { REDIS_CHANNELS } from "@/lib/utils/constants";

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }

  return redis;
}

export async function publishRealtimeEvent<T>(type: RealtimeEventName, payload: T): Promise<void> {
  const event: RealtimeEvent<T> = {
    type,
    payload,
    emittedAt: new Date().toISOString()
  };

  await getRedis().publish(REDIS_CHANNELS.REALTIME_EVENTS, JSON.stringify(event));
}
