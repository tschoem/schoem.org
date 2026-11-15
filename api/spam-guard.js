/* eslint-env node */
// Spam protection for the contact form.
// Layers: honeypot field, minimum fill time, gibberish detection, per-IP rate limit.

const MIN_FILL_MS = 3000; // humans don't fill name + email + message in under 3s
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5; // submissions per IP per window
const RATE_LIMIT_WINDOW_S = 60 * 60;

/**
 * Check the hidden honeypot field and the time between form render and submit.
 * Returns a reason string when the submission looks automated, otherwise null.
 */
export function checkBotSignals({ website, formStartedAt }) {
  if (website) return 'honeypot';

  const started = Number(formStartedAt);
  if (!Number.isFinite(started)) return 'missing-timestamp';

  const elapsed = Date.now() - started;
  if (elapsed < MIN_FILL_MS) return 'too-fast';
  if (elapsed > MAX_FORM_AGE_MS) return 'stale-form';

  return null;
}

/**
 * Count lower→upper case switches inside a word ("gAzGbpk" → 2, "GitHub" → 1).
 */
function caseSwitches(word) {
  let switches = 0;
  for (let i = 1; i < word.length; i++) {
    if (/[a-z]/.test(word[i - 1]) && /[A-Z]/.test(word[i])) switches++;
  }
  return switches;
}

/**
 * Detect random-string messages like "gAzGbpkdvkiSsfkfZ".
 */
export function looksLikeGibberish(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;

  const words = trimmed.split(/\s+/);

  // A single long "word" with no spaces is not a real enquiry (URLs excluded)
  if (words.length === 1 && trimmed.length >= 8 && !/^https?:\/\//i.test(trimmed)) {
    return true;
  }

  // Most longer words have random mid-word capitals
  const longWords = words.filter((w) => /^[A-Za-z]{6,}$/.test(w));
  if (longWords.length > 0) {
    const weird = longWords.filter((w) => caseSwitches(w) >= 2).length;
    if (weird / longWords.length >= 0.5) return true;
  }

  return false;
}

// ---- Rate limiting -------------------------------------------------------

const memoryHits = new Map(); // fallback when Redis isn't configured
let upstash;

async function getUpstash() {
  if (upstash !== undefined) return upstash;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      upstash = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch (error) {
      console.error('Upstash init failed, using in-memory rate limit:', error.message);
      upstash = null;
    }
  } else {
    upstash = null;
  }
  return upstash;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Returns true when this IP has exceeded the contact-form limit.
 * Fails open (allows) if Redis errors, so a Redis outage doesn't break the form.
 */
export async function isRateLimited(ip) {
  const key = `contact-rl:${ip}`;
  const redis = await getUpstash();

  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_S);
      return count > RATE_LIMIT_MAX;
    } catch (error) {
      console.error('Rate limit check failed:', error.message);
      return false;
    }
  }

  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || entry.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_S * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}
