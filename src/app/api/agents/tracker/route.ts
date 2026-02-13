import { NextRequest, NextResponse } from "next/server"
import { TrackerAgent } from "@/agents/tracker-agent"

/**
 * API Route: Trigger Tracker Agent
 * POST /api/agents/tracker
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

    const agent = new TrackerAgent(userId)
    const metrics = await agent.managePipeline()

    return NextResponse.json({
      success: true,
      metrics,
    })
  } catch (error) {
    console.error("Tracker Agent Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
