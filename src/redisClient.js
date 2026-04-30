const { createClient } = require("redis");

const client = createClient(); // Defaults to localhost:6379
const subscriber = client.duplicate(); // Needed for Pub/Sub

client.on("error", (err) => console.log("Redis Client Error", err));

async function connectRedis() {
  await client.connect();
  await subscriber.connect();
  console.log("Connected to Redis");
}

module.exports = { client, subscriber, connectRedis };
