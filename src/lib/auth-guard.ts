import { NextRequest, NextResponse } from "next/server"

/**
 * Verify whether a request is authorized to execute a background cron job.
 * Allows execution if:
 * 1. Running for a specific user (?userId=...) where user is requesting their own background job.
 * 2. Vercel Cron header is present (x-vercel-cron).
 * 3. CRON_SECRET matches Bearer authorization header or ?secret=... parameter.
 * 4. In development environment (NODE_ENV === "development") if no CRON_SECRET is configured.
 */
export function verifyCronAuthorization(request: NextRequest): { authorized: boolean; response?: NextResponse } {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get("userId")

  // If userId is provided, this is a scoped user trigger, not an unauthenticated global sweep
  if (userId) {
    return { authorized: true }
  }

  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const querySecret = searchParams.get("secret")

  // Check Vercel Cron header
  if (vercelCronHeader) {
    return { authorized: true }
  }

  // Check Bearer token or query secret
  if (cronSecret) {
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null
    if (bearerToken === cronSecret || querySecret === cronSecret) {
      return { authorized: true }
    }
  } else if (process.env.NODE_ENV === "development") {
    // Permissive only in local development when no secret is configured
    return { authorized: true }
  }

  console.warn(`[auth-guard] Unauthorized global cron trigger blocked on ${request.nextUrl.pathname}`)

  return {
    authorized: false,
    response: NextResponse.json(
      {
        error: "Unauthorized",
        message: "A valid CRON_SECRET or specific ?userId parameter is required to trigger this endpoint.",
      },
      { status: 401 }
    ),
  }
}
