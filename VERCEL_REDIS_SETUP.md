# Vercel Redis Setup for Mix Confirmation

The mix confirmation flow requires persistent storage to work on Vercel. This guide explains how to set up Redis for this purpose.

## Table of Contents
1. [Why Redis?](#why-redis)
2. [Setup Steps](#setup-steps)
3. [How It Works](#how-it-works)
4. [Testing](#testing)
5. [Troubleshooting](#troubleshooting)

## Why Redis?

On Vercel, serverless functions are stateless and don't share memory between invocations. The mix confirmation tokens need to be stored persistently so they can be retrieved when users click the confirmation link in their email.

## Setup Steps

### 1. Create a Redis Database

Vercel offers Redis through their Marketplace. You can use:

- **Upstash Redis** (recommended for serverless) - HTTP-based, perfect for Vercel
- **Redis Cloud** - Standard Redis provider

#### Option A: Upstash Redis (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to the **Storage** tab
3. Click **Create Database**
4. Select **Upstash Redis** (or find it in the Marketplace)
5. Choose a name for your database (e.g., "mix-confirmation")
6. Select a region (choose one close to your users)
7. Click **Create**

#### Option B: Redis Cloud

1. Go to your Vercel project dashboard
2. Navigate to the **Storage** tab or **Marketplace**
3. Find **Redis Cloud** or **Redis (serverless)**
4. Follow the setup instructions

### 2. Environment Variables

After creating the Redis database, Vercel automatically injects environment variables. Check your project settings:

**For Upstash Redis:**
- `UPSTASH_REDIS_REST_URL` - The REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - The REST API token

**For Standard Redis:**
- `REDIS_URL` - The Redis connection URL (format: `redis://user:password@host:port`)

### 3. Verify Environment Variables

1. Go to your Vercel project **Settings**
2. Navigate to **Environment Variables**
3. Verify the Redis variables are present:
   - For Upstash: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - For Standard Redis: `REDIS_URL`

### 4. Install the Package

The required package is already included in `package.json`:
- `@upstash/redis` - For Upstash Redis (recommended)
- `redis` - For standard Redis (if not using Upstash)

If you need to install manually:

```bash
# For Upstash (recommended)
npm install @upstash/redis

# OR for standard Redis
npm install redis
```

## How It Works

- **Local Development**: Uses in-memory storage (no Redis needed)
- **Vercel Production**: Automatically uses Redis if environment variables are set
  - Prefers Upstash if `UPSTASH_REDIS_REST_URL` is available
  - Falls back to standard Redis if `REDIS_URL` is available
  - Falls back to in-memory if neither is configured (won't work across serverless invocations)

## Testing

1. Deploy to Vercel with the environment variables set
2. Create a mix and request an email
3. Click the confirmation link in the email
4. The playlist should be created successfully

## Troubleshooting

- **"Invalid or expired confirmation token"**: 
  - Check that Redis environment variables are set in Vercel
  - Check Vercel function logs to see if Redis is being used
  - Look for messages like "✅ Using Upstash Redis" or "✅ Using standard Redis"

- **Storage not working**: 
  - Check Vercel function logs to see if Redis initialization succeeded
  - Verify the Redis database is active in Vercel Storage tab
  - Ensure environment variables are set for the correct environment (Production, Preview, Development)

- **Connection errors**: 
  - For Upstash: Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
  - For standard Redis: Verify `REDIS_URL` format is correct

## Logs to Check

In your Vercel function logs, you should see:
- `✅ Using Upstash Redis for persistent storage` - Successfully using Upstash
- `✅ Using standard Redis for persistent storage` - Successfully using standard Redis
- `⚠️ Redis not configured, using in-memory storage` - Redis not available (will fail on Vercel)
- `✅ Stored mix data in Redis for token: ...` - Token stored successfully
- `Redis get result for token ...: found` - Token retrieved successfully
