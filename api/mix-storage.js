/* eslint-env node */
// Storage abstraction for mix confirmation tokens
// Uses Vercel KV in production, in-memory Map for local development

let kv = null;
let kvInitialized = false;
const pendingPlaylists = new Map(); // Fallback for local development

// Initialize Vercel KV if available
async function ensureKV() {
  if (kvInitialized) {
    return kv !== null;
  }
  
  kvInitialized = true;
  
  // Check if KV environment variables are set
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      // Dynamic import to avoid errors if package is not installed
      const kvModule = await import('@vercel/kv');
      kv = kvModule.kv;
      console.log('✅ Using Vercel KV for persistent storage');
      return true;
    } catch (error) {
      console.log('⚠️ Vercel KV package not installed, using in-memory storage');
      return false;
    }
  } else {
    console.log('⚠️ Vercel KV not configured, using in-memory storage');
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

  const useKV = await ensureKV();
  
  if (useKV && kv) {
    // Store in Vercel KV with TTL
    const ttl = 24 * 60 * 60; // 24 hours in seconds
    await kv.set(`mix:${tokenId}`, JSON.stringify(dataWithExpiry), { ex: ttl });
    console.log(`Stored mix data in KV for token: ${tokenId}`);
  } else {
    // Store in memory
    pendingPlaylists.set(tokenId, dataWithExpiry);
    console.log(`Stored mix data in memory for token: ${tokenId}`);
  }
}

export async function getMixData(tokenId) {
  const useKV = await ensureKV();
  
  if (useKV && kv) {
    // Get from Vercel KV
    const data = await kv.get(`mix:${tokenId}`);
    if (!data) {
      return null;
    }
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Check expiration (KV TTL should handle this, but double-check)
    if (Date.now() > parsed.expiresAt) {
      await deleteMixData(tokenId);
      return null;
    }
    
    return parsed;
  } else {
    // Get from memory
    const data = pendingPlaylists.get(tokenId);
    if (!data) {
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
  const useKV = await ensureKV();
  
  if (useKV && kv) {
    // Delete from Vercel KV
    await kv.del(`mix:${tokenId}`);
    console.log(`Deleted mix data from KV for token: ${tokenId}`);
  } else {
    // Delete from memory
    pendingPlaylists.delete(tokenId);
    console.log(`Deleted mix data from memory for token: ${tokenId}`);
  }
}

// Clean up expired tokens (only needed for in-memory storage)
setInterval(() => {
  if (!kv) {
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
