# Security Fixes Applied

This document summarizes the security fixes applied to address critical and high-risk vulnerabilities.

## Critical Issues Fixed

### 1. XSS (Cross-Site Scripting) Vulnerabilities ✅
**Files Modified:**
- `api/share-mix.js`
- `api/send-email.js`

**Changes:**
- Added `DOMPurify` to sanitize all user inputs before inserting into HTML
- All user-provided strings (playlistName, description, name, email, message, track titles/artists) are now sanitized
- HTML tags are stripped from user inputs in email templates

**Example:**
```javascript
const sanitizedPlaylistName = DOMPurify.sanitize(playlistName, { ALLOWED_TAGS: [] });
```

### 2. Email Injection Vulnerabilities ✅
**Files Modified:**
- `api/send-email.js`
- `api/share-mix.js`

**Changes:**
- Added `validator` library for email validation
- Email addresses are normalized and validated before use
- Email headers are sanitized to prevent header injection
- `replyTo` field uses sanitized email

**Example:**
```javascript
if (!validator.isEmail(email)) {
  return res.status(400).json({ error: 'Invalid email address' });
}
const sanitizedEmail = validator.normalizeEmail(email) || email;
```

### 3. CORS Too Permissive ✅
**Files Modified:**
- `server.js`

**Changes:**
- CORS now restricted to specific allowed origins
- Default origins: localhost variants and schoem.org
- Configurable via `ALLOWED_ORIGINS` environment variable
- Credentials support enabled for authenticated requests

**Example:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', ...];
```

## High Priority Issues Fixed

### 4. Rate Limiting ✅
**Files Modified:**
- `server.js`

**Changes:**
- Added `express-rate-limit` middleware
- Email endpoints: 5 requests per 15 minutes
- API endpoints: 100 requests per 15 minutes
- Prevents abuse and DoS attacks

**Example:**
```javascript
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many email requests, please try again later.'
});
```

### 5. Input Length Limits ✅
**Files Modified:**
- `api/share-mix.js`
- `api/send-email.js`

**Changes:**
- Playlist name: max 200 characters
- Description: max 1000 characters
- Name: max 100 characters
- Message: max 5000 characters
- Track count: max 500 tracks
- Prevents DoS via large payloads

**Example:**
```javascript
if (playlistName.length > 200) {
  return res.status(400).json({ error: 'Playlist name too long (max 200 characters)' });
}
```

### 6. CSRF Protection ✅
**Files Modified:**
- `api/security-utils.js` (new file)
- `api/share-mix.js`
- `api/send-email.js`
- `api/confirm-mix.js`

**Changes:**
- Created security utility for origin validation
- POST endpoints validate request origin
- GET endpoints log but don't block (for email links)
- Prevents cross-site request forgery attacks

**Example:**
```javascript
if (!validateOrigin(req, getAllowedOrigins())) {
  return res.status(403).json({ error: 'Forbidden: Invalid origin' });
}
```

## Additional Security Improvements

### 7. Input Validation ✅
**Files Modified:**
- `api/share-mix.js`
- `api/confirm-mix.js`

**Changes:**
- Spotify URI format validation (must match `spotify:track:...`)
- Token format validation (32 hex characters)
- Array type validation for trackUris

### 8. Request Body Size Limit ✅
**Files Modified:**
- `server.js`

**Changes:**
- Added 10MB limit on JSON request bodies
- Prevents DoS via extremely large requests

## New Dependencies

The following packages were added:
- `dompurify` / `isomorphic-dompurify` - HTML sanitization
- `validator` - Input validation and sanitization
- `express-rate-limit` - Rate limiting middleware

## Environment Variables

New optional environment variable:
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (e.g., `https://schoem.org,https://www.schoem.org`)

## Testing Recommendations

1. **Test XSS protection**: Try submitting HTML/JavaScript in form fields
2. **Test email injection**: Try submitting email with newlines or special characters
3. **Test rate limiting**: Make multiple rapid requests to email endpoints
4. **Test CORS**: Try making requests from unauthorized origins
5. **Test input limits**: Try submitting very long strings
6. **Test CSRF**: Try making requests without proper origin headers

## Notes

- All user inputs are now sanitized before use
- Email addresses are validated and normalized
- Rate limiting prevents abuse
- CORS is restricted to known origins
- CSRF protection validates request origins
- Input length limits prevent DoS attacks

## Remaining Medium Priority Issues

These can be addressed in a future update:
- Token exposure in URLs (mitigated by 24-hour expiration and one-time use)
- Error information disclosure (generic errors returned to clients)
- Request size limits (10MB limit added)
