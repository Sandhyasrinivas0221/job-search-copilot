/**
 * Rate Limiting Middleware for Production
 *
 * Protects against:
 * - Cost explosion from rate-limited API calls
 * - Gmail API quota exhaustion
 * - Resend email quota abuse
 * - DDoS attacks on endpoints
 *
 * Usage: Wrap your API endpoints with this middleware
 */

import { NextRequest, NextResponse } from "next/server"

// In-memory rate limit store (for single server/serverless function)
// For distributed systems, use Redis
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Configuration for different rate limit types
 */
export const RATE_LIMITS = {
  // Cron endpoints - prevent abuse of background jobs
  CRON_ENDPOINT: {
    windowMs: 60000, // 1 minute
    maxRequests: 1, // Max 1 per minute per user
  },
  // Gmail API - respect Google's quotas
  GMAIL_API: {
    windowMs: 60000, // 1 minute
    maxRequests: 15, // Gmail: 15 req/sec per user
  },
  // Email sending - prevent spam
  EMAIL_SEND: {
    windowMs: 3600000, // 1 hour
    maxRequests: 100, // Max 100 emails per hour
  },
  // General API endpoints
  API_GENERAL: {
    windowMs: 60000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  // Public endpoints (stricter)
  PUBLIC_ENDPOINT: {
    windowMs: 60000,
    maxRequests: 10,
  },
}

/**
 * Rate limiter middleware
 */
export async function rateLimit(
  request: NextRequest,
  limitConfig: { windowMs: number; maxRequests: number }
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
             request.headers.get("x-real-ip") || 
             "unknown"
  const userId = request.nextUrl.searchParams.get("userId") || "anonymous"
  const key = `${ip}:${userId}`

  const now = Date.now()
  let record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + limitConfig.windowMs,
    }
  }

  record.count++
  rateLimitStore.set(key, record)

  const allowed = record.count <= limitConfig.maxRequests
  const remaining = Math.max(0, limitConfig.maxRequests - record.count)
  const resetTime = record.resetTime

  return { allowed, remaining, resetTime }
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": new Date(resetTime).toISOString(),
  }
}

/**
 * Get rate limit status
 */
export async function checkRateLimit(
  request: NextRequest,
  limitType: keyof typeof RATE_LIMITS
): Promise<NextResponse | null> {
  const config = RATE_LIMITS[limitType]
  const result = await rateLimit(request, config)

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          ...createRateLimitHeaders(result.remaining, result.resetTime),
        },
      }
    )
  }

  return null
}

/**
 * Clean up old records (run periodically to prevent memory leak)
 */
export function cleanupRateLimit() {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + 300000) {
      // Keep records for 5 min after expiry, then delete
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Reset rate limit for a specific key (admin only)
 */
export function resetRateLimitForUser(userId: string) {
  for (const key of rateLimitStore.keys()) {
    if (key.includes(userId)) {
      rateLimitStore.delete(key)
    }
  }
}
