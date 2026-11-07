import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/server-auth"

export interface CronAuthResult {
  authorized: boolean
  response?: NextResponse
  isCronRunner?: boolean
  authenticatedUserId?: string
}

/**
 * Verify whether a request is authorized to execute a background cron job.
 * Strict Security:
 * 1. Global execution requires valid Vercel Cron header (x-vercel-cron) or matching CRON_SECRET.
 * 2. User-scoped execution (?userId=...) CANNOT bypass authorization; the caller MUST provide
 *    a valid Bearer JWT or guest token verifying they actually own that userId.
 */
export async function verifyCronAuthorization(
  request: NextRequest,
  explicitUserId?: string | null
): Promise<CronAuthResult> {
  const searchParams = request.nextUrl.searchParams
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const querySecret = searchParams.get("secret")

  // 1. Check Vercel Cron header (production automated scheduler)
  if (vercelCronHeader) {
    return { authorized: true, isCronRunner: true }
  }

  // 2. Check Bearer token or query secret matching CRON_SECRET
  if (cronSecret && cronSecret.length >= 8) {
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null
    if (bearerToken === cronSecret || querySecret === cronSecret) {
      return { authorized: true, isCronRunner: true }
    }
  }

  // 3. User-scoped trigger: ?userId=... requires caller session verification
  const userId = explicitUserId || searchParams.get("userId")
  if (userId) {
    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) {
      return {
        authorized: false,
        response: auth.response || NextResponse.json(
          { error: "Unauthorized", message: "You are not authorized to trigger background jobs for this userId." },
          { status: 401 }
        ),
      }
    }

    return {
      authorized: true,
      isCronRunner: false,
      authenticatedUserId: auth.userId,
    }
  }

  // Permissive only in local development when no secret is configured
  if (process.env.NODE_ENV === "development" && !cronSecret) {
    return { authorized: true, isCronRunner: true }
  }

  console.warn(`[auth-guard] Unauthorized cron trigger blocked on ${request.nextUrl.pathname}`)

  return {
    authorized: false,
    response: NextResponse.json(
      {
        error: "Unauthorized",
        message: "A valid CRON_SECRET or an authenticated user session matching ?userId is required.",
      },
      { status: 401 }
    ),
  }
}
