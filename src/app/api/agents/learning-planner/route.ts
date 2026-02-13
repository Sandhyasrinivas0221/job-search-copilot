import { NextRequest, NextResponse } from "next/server"
import { LearningPlannerAgent } from "@/agents/learning-planner-agent"

/**
 * API Route: Trigger Learning Planner Agent
 * POST /api/agents/learning-planner
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

    const agent = new LearningPlannerAgent(userId)
    const weeklyPlan = await agent.generateWeeklyLearningPlan()

    return NextResponse.json({
      success: true,
      weeklyPlan,
    })
  } catch (error) {
    console.error("Learning Planner Agent Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
