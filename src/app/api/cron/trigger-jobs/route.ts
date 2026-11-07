/**
 * Multi-User Job Market Search Endpoint
 *
 * Runs for a specific user (?userId=<id>) or all registered users (scheduled cron)
 * Route: POST /api/cron/trigger-jobs
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { JobMarketAgent } from "@/agents/job-market-agent"
import { getUser, getOrCreateUser } from "@/lib/db"
import { verifyCronAuthorization } from "@/lib/auth-guard"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  // Prevent unauthenticated public sweeps
  const authCheck = await verifyCronAuthorization(request)
  if (!authCheck.authorized) return authCheck.response!

  const rateLimitResponse = checkRateLimit(request, { limit: 20, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (userId) {
      console.log(`[trigger/jobs] Running job market search for single user: ${userId}`)
      const user = await getOrCreateUser(userId)
      const agent = new JobMarketAgent(userId, user)
      const suggestions = await agent.findJobsForUser()

      const { data: createdSuggestions } = await supabaseAdmin
        .from("job_suggestions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15)

      return NextResponse.json({
        success: true,
        message: "Job search completed successfully",
        jobsFound: suggestions.length,
        suggestionsCreated: createdSuggestions?.length || 0,
        suggestions: createdSuggestions || [],
      })
    }

    // Cron execution across all active users
    console.log("[trigger/jobs] Running scheduled job market search for all users...")
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("*")
      .limit(100)

    if (usersError || !users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users found for job search",
        processed: 0,
      })
    }

    let totalDiscovered = 0
    for (const u of users) {
      try {
        const agent = new JobMarketAgent(u.id, u)
        const suggestions = await agent.findJobsForUser()
        totalDiscovered += suggestions.length
      } catch (userErr) {
        console.error(`[trigger/jobs] Error searching jobs for user ${u.id}:`, userErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Job search completed for ${users.length} users`,
      totalDiscovered,
      usersProcessed: users.length,
    })
  } catch (error) {
    console.error("[trigger/jobs] Error searching jobs:", error)
    return NextResponse.json(
      {
        error: "Failed to search jobs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
