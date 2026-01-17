/* eslint-env node */
// Storage abstraction for mix confirmation tokens
// Uses Redis (Upstash or standard) in production, in-memory Map for local development

let redis = null;
let redisInitialized = false;
const pendingPlaylists = new Map(); // Fallback for local development

// Initialize Redis if available
async function ensureRedis() {
  if (redisInitialized) {
    return redis !== null;
  }
  
  redisInitialized = true;
  
  // Check for Upstash Redis (most common on Vercel)
  const hasUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  // Check for standard Redis
  const hasRedis = process.env.REDIS_URL;
  
  console.log('Redis Environment check:', {
    hasUpstash,
    hasRedis,
    hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    hasRedisUrl: !!process.env.REDIS_URL,
  });
  
  if (hasUpstash) {
    try {
      // Use Upstash Redis (HTTP-based, perfect for serverless)
      const { Redis } = await import('@upstash/redis');
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      console.log('✅ Using Upstash Redis for persistent storage');
      return true;
    } catch (error) {
      console.error('⚠️ Upstash Redis initialization failed:', error.message);
      console.error('Error details:', error);
      console.log('⚠️ Falling back to in-memory storage');
      return false;
    }
  } else if (hasRedis) {
    try {
      // Use standard Redis client
      const redisModule = await import('redis');
      const client = redisModule.createClient({
        url: process.env.REDIS_URL,
      });
      client.on('error', (err) => console.error('Redis Client Error:', err));
      await client.connect();
      redis = client;
      console.log('✅ Using standard Redis for persistent storage');
      return true;
    } catch (error) {
      console.error('⚠️ Redis initialization failed:', error.message);
      console.error('Error details:', error);
      console.log('⚠️ Falling back to in-memory storage');
      return false;
    }
  } else {
    console.log('⚠️ Redis not configured, using in-memory storage');
    return false;
  }
}

// Storage operations
export async function storeMixData(tokenId, data) {
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  const dataWithExpiry = {
    ...data,
    expiresAt
  };

  const useRedis = await ensureRedis();
  
  if (useRedis && redis) {
    try {
      // Store in Redis with TTL
      const ttl = 24 * 60 * 60; // 24 hours in seconds
      const key = `mix:${tokenId}`;
      const value = JSON.stringify(dataWithExpiry);
      
      // Upstash uses set with ex option, standard Redis uses setEx or set with EX
      if (process.env.UPSTASH_REDIS_REST_URL) {
        // Upstash Redis
        await redis.set(key, value, { ex: ttl });
      } else {
        // Standard Redis - use SET with EX option
        await redis.set(key, value, { EX: ttl });
      }
      
      console.log(`✅ Stored mix data in Redis for token: ${tokenId}`);
    } catch (error) {
      console.error('❌ Failed to store in Redis, falling back to memory:', error.message);
      // Fallback to memory if Redis fails
      pendingPlaylists.set(tokenId, dataWithExpiry);
      console.log(`Stored mix data in memory for token: ${tokenId} (fallback)`);
    }
  } else {
    // Store in memory
    pendingPlaylists.set(tokenId, dataWithExpiry);
    console.log(`Stored mix data in memory for token: ${tokenId}`);
  }
}

export async function getMixData(tokenId) {
  const useRedis = await ensureRedis();
  
  if (useRedis && redis) {
    try {
      // Get from Redis
      const key = `mix:${tokenId}`;
      const data = await redis.get(key);
      
      console.log(`Redis get result for token ${tokenId}:`, data ? 'found' : 'not found');
      
      if (!data) {
        return null;
      }
      
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Check expiration (Redis TTL should handle this, but double-check)
      if (Date.now() > parsed.expiresAt) {
        console.log(`Token ${tokenId} expired, deleting`);
        await deleteMixData(tokenId);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ Failed to get from Redis:', error.message);
      // Fallback to memory
      const data = pendingPlaylists.get(tokenId);
      if (!data) {
        return null;
      }
      if (Date.now() > data.expiresAt) {
        pendingPlaylists.delete(tokenId);
        return null;
      }
      return data;
    }
  } else {
    // Get from memory
    const data = pendingPlaylists.get(tokenId);
    if (!data) {
      console.log(`Token ${tokenId} not found in memory`);
      return null;
    }
    
    // Check expiration
    if (Date.now() > data.expiresAt) {
      pendingPlaylists.delete(tokenId);
      return null;
    }
    
    return data;
  }
}

export async function deleteMixData(tokenId) {
  const useRedis = await ensureRedis();
  
  if (useRedis && redis) {
    try {
      // Delete from Redis
      const key = `mix:${tokenId}`;
      await redis.del(key);
      console.log(`Deleted mix data from Redis for token: ${tokenId}`);
    } catch (error) {
      console.error('❌ Failed to delete from Redis:', error.message);
      // Fallback to memory
      pendingPlaylists.delete(tokenId);
      console.log(`Deleted mix data from memory for token: ${tokenId} (fallback)`);
    }
  } else {
    // Delete from memory
    pendingPlaylists.delete(tokenId);
    console.log(`Deleted mix data from memory for token: ${tokenId}`);
  }
}

// Clean up expired tokens (only needed for in-memory storage)
setInterval(() => {
  if (!redis) {
    const now = Date.now();
    for (const [tokenId, data] of pendingPlaylists.entries()) {
      if (data.expiresAt < now) {
        pendingPlaylists.delete(tokenId);
      }
    }
  }
}, 3600000); // 1 hour

// Export for backward compatibility (local dev only)
export { pendingPlaylists };
