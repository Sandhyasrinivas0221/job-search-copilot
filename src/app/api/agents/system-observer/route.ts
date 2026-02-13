import { NextRequest, NextResponse } from "next/server"
import { SystemObserverAgent } from "@/agents/system-observer-agent"

/**
 * API Route: Trigger System Observer Agent
 * POST /api/agents/system-observer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sendEmail = false } = body

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const agent = new SystemObserverAgent(userId)
    const metrics = await agent.computeMetrics()

    if (sendEmail) {
      const summary = await agent.buildDailyEmailSummary()
      await agent.sendDailyEmail(summary)
    }

    // Check for escalations
    const lowInterviewRate = await agent.checkLowInterviewRateEscalation()

    return NextResponse.json({
      success: true,
      metrics,
      escalations: {
        lowInterviewRate,
      },
    })
  } catch (error) {
    console.error("System Observer Agent Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
