/**
 * Manual Trigger Endpoint: Search for Jobs
 *
 * Allows manual triggering of job market search for a specific user
 * TEST DATA: Useful for testing without waiting for scheduled cron jobs (COMMENTED OUT FOR PRODUCTION)
 *
 * Endpoint: POST /api/cron/trigger-jobs?userId=<id>
 * (Note: This agent is DISABLED in production - no free job API available)
 *
 * Query Parameters:
 * - userId (required): User ID to search jobs for
 *
 * Returns:
 * - Job listings found, suggestions created, and top matches
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { JobMarketAgent } from "@/agents/job-market-agent"
import { getUser } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      )
    }

    console.log(`[trigger/jobs] Starting job market search for user ${userId}`)

    // Get user to pass to agent
    const user = await getUser(userId)

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Instantiate and run the Job Market Agent
    const agent = new JobMarketAgent(userId, user)
    const suggestions = await agent.findJobsForUser()

    console.log(
      `[trigger/jobs] Found ${suggestions.length} job suggestions for user ${userId}`
    )

    // Get the created suggestions to return details
    const { data: createdSuggestions, error: suggestionsError } = await supabaseAdmin
      .from("job_suggestions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15)

    if (suggestionsError) {
      console.error(`[trigger/jobs] Error fetching suggestions:`, suggestionsError)
    }

    // Sort by match score to show top matches
    const topMatches = (createdSuggestions || [])
      .sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      message: "Job search completed successfully",
      jobsFound: suggestions.length,
      suggestionsCreated: createdSuggestions?.length || 0,
      topMatches: topMatches.map((job: any) => ({
        id: job.id,
        jobTitle: job.job_title,
        companyName: job.company_name,
        matchScore: job.match_score,
        easyApply: job.easy_apply,
        location: job.location,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        sourceSite: job.source_site,
      })),
      summary: {
        easyApplyCount: (createdSuggestions || []).filter((s: any) => s.easy_apply).length,
        avgMatchScore: createdSuggestions && createdSuggestions.length > 0
          ? (createdSuggestions.reduce((sum: number, s: any) => sum + (s.match_score || 0), 0) / createdSuggestions.length).toFixed(1)
          : 0,
      },
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
