/* eslint-env node */
// Security utility functions for API endpoints

/**
 * Validate request origin for CSRF protection
 * @param {Object} req - Express request object
 * @param {Array} allowedOrigins - Array of allowed origin strings
 * @returns {boolean} - True if origin is valid
 */
export function validateOrigin(req, allowedOrigins = []) {
  const origin = req.headers.origin || req.headers.referer;
  
  if (!origin) {
    // Allow requests with no origin (like server-to-server or curl)
    return true;
  }

  // Extract origin from referer if needed
  let originUrl;
  try {
    originUrl = new URL(origin);
    const originHost = originUrl.origin;
    
    // Check against allowed origins
    if (allowedOrigins.length === 0) {
      // If no allowed origins specified, allow localhost and 127.0.0.1 for dev
      return originHost.includes('localhost') || 
             originHost.includes('127.0.0.1') ||
             originHost.includes('schoem.org');
    }
    
    return allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        return originHost === allowedUrl.origin;
      } catch {
        return originHost.includes(allowed);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Get allowed origins from environment variable
 * @returns {Array} - Array of allowed origins
 */
export function getAllowedOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Default allowed origins
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://schoem.org',
    'https://www.schoem.org'
  ];
}
