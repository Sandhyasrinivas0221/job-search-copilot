import { NextRequest, NextResponse } from "next/server"
import { JobMarketAgent } from "@/agents/job-market-agent"
import { getUser } from "@/lib/db"

/**
 * API Route: Trigger Job Market Agent
 * POST /api/agents/job-market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const agent = new JobMarketAgent(userId, user)
    const suggestions = await agent.findJobsForUser()

    return NextResponse.json({
      success: true,
      jobsFound: suggestions.length,
      suggestions,
    })
  } catch (error) {
    console.error("Job Market Agent Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
