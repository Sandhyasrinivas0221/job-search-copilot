import { NextRequest, NextResponse } from "next/server"
import { SkillResearchAgent } from "@/agents/skill-research-agent"
import { getUser } from "@/lib/db"

/**
 * API Route: Trigger Skill Research Agent
 * POST /api/agents/skill-research
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

    const agent = new SkillResearchAgent(userId, user)
    const clusters = await agent.analyzeMarketSkills()

    return NextResponse.json({
      success: true,
      skillClusters: clusters,
    })
  } catch (error) {
    console.error("Skill Research Agent Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
