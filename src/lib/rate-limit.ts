import { NextRequest, NextResponse } from "next/server"

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory sliding window rate limit store
const ipCache = new Map<string, RateLimitRecord>()

// Periodic garbage collection every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of ipCache.entries()) {
      if (now > record.resetTime) {
        ipCache.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitOptions {
  limit?: number // Maximum requests allowed in the window
  windowSeconds?: number // Time window in seconds
  identifier?: string // Optional custom identifier (e.g. userId)
}

/**
 * Check and enforce rate limiting for API routes
 * @returns null if allowed, or NextResponse with HTTP 429 if limit exceeded
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const limit = options.limit || 30
  const windowSeconds = options.windowSeconds || 60
  const windowMs = windowSeconds * 1000

  // Derive client IP or unique identifier
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")
  const clientIp =
    options.identifier ||
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
    realIp ||
    cfConnectingIp ||
    "unknown-client"

  const routeKey = `${request.nextUrl.pathname}:${clientIp}`
  const now = Date.now()

  let record = ipCache.get(routeKey)

  if (!record || now > record.resetTime) {
    // New window
    record = {
      count: 1,
      resetTime: now + windowMs,
    }
    ipCache.set(routeKey, record)
    return null
  }

  record.count += 1

  if (record.count > limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    console.warn(`[rate-limit] Blocked request from ${clientIp} to ${request.nextUrl.pathname} (Count: ${record.count}/${limit})`)
    
    return NextResponse.json(
      {
        error: "Too many requests. Please slow down.",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(record.resetTime / 1000)),
        },
      }
    )
  }

  return null
}
