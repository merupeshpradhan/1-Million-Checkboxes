const { client } = require('./redisClient');

async function isRateLimited(userId) {
    const limit = 10; // Max 10 clicks...
    const windowSeconds = 5; // ...every 5 seconds
    
    const key = `ratelimit:${userId}`;
    
    // Increment the user's count in Redis
    const currentCount = await client.incr(key);
    
    // If it's the first click in this window, set an expiration
    if (currentCount === 1) {
        await client.expire(key, windowSeconds);
    }
    
    // If they go over the limit, return true (they are limited)
    if (currentCount > limit) {
        return true;
    }
    
    return false;
}

module.exports = { isRateLimited };