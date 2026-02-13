import { NextRequest, NextResponse } from "next/server"
import { SystemObserverAgent } from "@/agents/system-observer-agent"

/**
 * API Route: Get Dashboard Metrics
 * GET /api/metrics?userId=<id>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const agent = new SystemObserverAgent(userId)
    const metrics = await agent.computeMetrics()

    return NextResponse.json({
      success: true,
      metrics,
    })
  } catch (error) {
    console.error("Metrics API Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
