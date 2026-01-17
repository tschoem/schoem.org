# Vercel KV Setup for Mix Confirmation

The mix confirmation flow requires persistent storage to work on Vercel. This guide explains how to set up Vercel KV (Redis) for this purpose.

## Why Vercel KV?

On Vercel, serverless functions are stateless and don't share memory between invocations. The mix confirmation tokens need to be stored persistently so they can be retrieved when users click the confirmation link in their email.

## Setup Steps

### 1. Create a Vercel KV Database

1. Go to your Vercel project dashboard
2. Navigate to the **Storage** tab
3. Click **Create Database**
4. Select **KV** (Redis)
5. Choose a name for your database (e.g., "mix-confirmation")
6. Select a region (choose one close to your users)
7. Click **Create**

### 2. Link the Database to Your Project

1. In the KV database page, click **.env.local** tab
2. Copy the environment variables shown:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN` (optional, for read-only operations)

### 3. Add Environment Variables to Vercel

1. Go to your Vercel project **Settings**
2. Navigate to **Environment Variables**
3. Add the following variables:
   - `KV_REST_API_URL` - The REST API URL for your KV database
   - `KV_REST_API_TOKEN` - The REST API token for your KV database

### 4. Install the Package (if not already installed)

The `@vercel/kv` package is already included in `package.json`. If you need to install it manually:

```bash
npm install @vercel/kv
```

## How It Works

- **Local Development**: Uses in-memory storage (no KV needed)
- **Vercel Production**: Automatically uses Vercel KV if environment variables are set
- **Fallback**: If KV is not configured, falls back to in-memory (won't work across serverless invocations)

## Testing

1. Deploy to Vercel with the environment variables set
2. Create a mix and request an email
3. Click the confirmation link in the email
4. The playlist should be created successfully

## Troubleshooting

- **"Invalid or expired confirmation token"**: Check that `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set in Vercel environment variables
- **Storage not working**: Check Vercel function logs to see if KV is being used or if it's falling back to in-memory storage
