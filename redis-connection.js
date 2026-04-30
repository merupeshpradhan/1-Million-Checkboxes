import Redis from "ioredis";

function createRedisConnection() {
  return new Redis({
    host: "127.0.0.1",
    port: 6379,
  });
}

export const redis = createRedisConnection();
