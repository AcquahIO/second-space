import { Queue } from "bullmq";
import Redis from "ioredis";
import { QUEUE_NAMES } from "@/lib/utils/constants";

let queue: Queue | null = null;
let redis: Redis | null = null;

export function getTaskQueue() {
  if (!queue) {
    redis =
      redis ??
      new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      });

    queue = new Queue(QUEUE_NAMES.TASK_EXECUTION, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 200
      }
    });
  }

  return queue;
}
