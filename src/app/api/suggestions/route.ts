import { NextRequest, NextResponse } from "next/server"
import {
  getJobSuggestions,
  updateJobSuggestion,
  createApplication,
  createStatusHistory,
} from "@/lib/db"
import { ApplicationStatus } from "@/types"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * API Route: Job Suggestions
 * GET   /api/suggestions?userId=<id>&applied=<true|false>&dismissed=<true|false>
 * PATCH /api/suggestions (body: { id, applied?: boolean, dismissed?: boolean })
 * POST  /api/suggestions (body: { suggestion, userId }) -> Converts suggestion to application
 */

export async function GET(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 120, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const appliedParam = searchParams.get("applied")
    const dismissedParam = searchParams.get("dismissed")

    // By default, filter out applied and dismissed jobs unless explicitly asked
    const notApplied = appliedParam === "true" ? false : true
    const notDismissed = dismissedParam === "true" ? false : true

    const suggestions = await getJobSuggestions(userId, notApplied, notDismissed)

    return NextResponse.json({
      success: true,
      suggestions,
    })
  } catch (error) {
    console.error("Suggestions GET Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 60, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { id, applied, dismissed } = body

    if (!id) {
      return NextResponse.json(
        { error: "Missing suggestion id" },
        { status: 400 }
      )
    }

    const updates: Record<string, any> = {}
    if (typeof applied === "boolean") updates.applied = applied
    if (typeof dismissed === "boolean") updates.dismissed = dismissed

    const updated = await updateJobSuggestion(id, updates)

    return NextResponse.json({
      success: true,
      suggestion: updated,
    })
  } catch (error) {
    console.error("Suggestions PATCH Error:", error)
    return NextResponse.json(
      { error: "Failed to update suggestion" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 30, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { suggestion, userId } = body

    if (!suggestion || !userId) {
      return NextResponse.json(
        { error: "suggestion and userId are required" },
        { status: 400 }
      )
    }

    // 1. Create Application from Suggestion
    const newApp = await createApplication({
      user_id: userId,
      company_name: String(suggestion.company_name).substring(0, 100),
      job_title: String(suggestion.job_title).substring(0, 150),
      current_status: ApplicationStatus.APPLIED,
      location: suggestion.location ? String(suggestion.location).substring(0, 100) : null,
      salary_min: suggestion.salary_min ? Number(suggestion.salary_min) : null,
      salary_max: suggestion.salary_max ? Number(suggestion.salary_max) : null,
      job_url: suggestion.job_url ? String(suggestion.job_url).substring(0, 500) : null,
      description: suggestion.description ? String(suggestion.description).substring(0, 5000) : null,
      source_site: suggestion.source_site ? String(suggestion.source_site).substring(0, 50) : "Job Suggestion",
      easy_apply: Boolean(suggestion.easy_apply),
      applied_date: new Date().toISOString(),
      last_update: new Date().toISOString(),
      days_in_stage: 0,
    })

    if (!newApp) {
      return NextResponse.json(
        { error: "Failed to convert suggestion to application" },
        { status: 500 }
      )
    }

    // 2. Mark suggestion as applied
    if (suggestion.id) {
      await updateJobSuggestion(suggestion.id, { applied: true })
    }

    // 3. Log status history
    await createStatusHistory({
      application_id: newApp.id,
      user_id: userId,
      old_status: null,
      new_status: ApplicationStatus.APPLIED,
      reason: `Applied from Job Suggestion (match: ${suggestion.match_score || 0}%)`,
      notes: null,
      email_subject: null,
      email_body: null,
      detected_by: "USER",
    })

    return NextResponse.json({
      success: true,
      application: newApp,
    })
  } catch (error) {
    console.error("Suggestions POST Error:", error)
    return NextResponse.json(
      { error: "Failed to apply to suggestion" },
      { status: 500 }
    )
  }
}
