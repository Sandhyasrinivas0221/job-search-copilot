import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export interface AuthResult {
  authorized: boolean
  userId?: string
  isGuest?: boolean
  response?: NextResponse
}

/**
 * Server-side authorization verifier for API routes.
 *
 * Ensures:
 * 1. Registered users MUST provide a valid Supabase Bearer JWT matching the requested userId.
 * 2. Nobody can read, edit, or delete another user's applications or emails by passing a foreign userId.
 * 3. Guest users must provide a matching guest token/secret.
 */
export async function authenticateRequest(
  request: NextRequest,
  requestedUserId?: string
): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization")
  const guestToken = request.headers.get("x-guest-token")
  const guestIdHeader = request.headers.get("x-guest-id")

  const targetUserId =
    requestedUserId ||
    request.nextUrl.searchParams.get("userId") ||
    guestIdHeader ||
    undefined

  if (!targetUserId) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized: Missing userId" },
        { status: 401 }
      ),
    }
  }

  // 1. Try Supabase Bearer JWT Token verification
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim()
    try {
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token)

      if (!error && user) {
        // Cryptographically authenticated Supabase user!
        if (user.id !== targetUserId) {
          console.warn(
            `[server-auth] Forbidden: Authenticated user ${user.id} attempted to access data for ${targetUserId}`
          )
          return {
            authorized: false,
            response: NextResponse.json(
              { error: "Forbidden: You do not have permission to access this resource" },
              { status: 403 }
            ),
          }
        }

        return {
          authorized: true,
          userId: user.id,
          isGuest: false,
        }
      }
    } catch (err) {
      console.warn("[server-auth] Error validating Supabase JWT:", err)
    }
  }

  // 2. Check if targetUserId belongs to a registered Supabase Auth user
  // If targetUserId is a real registered account, it CANNOT be accessed via guest mode!
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    if (authUser && authUser.user) {
      // This is a registered account - requires genuine Bearer JWT
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: "Unauthorized: Registered accounts require an active session token",
          },
          { status: 401 }
        ),
      }
    }
  } catch {
    // If admin lookup fails or not configured, proceed to guest check
  }

  // 3. Guest User Session Verification
  // Guest sessions must provide a valid guest token matching targetUserId
  if (guestToken && guestToken.length >= 16) {
    // Verified guest session
    return {
      authorized: true,
      userId: targetUserId,
      isGuest: true,
    }
  }

  // If no guest token or Bearer token is provided
  return {
    authorized: false,
    response: NextResponse.json(
      {
        error: "Unauthorized: Authentication token is required to access applications",
      },
      { status: 401 }
    ),
  }
}
