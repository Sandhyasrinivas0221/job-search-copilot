import { NextRequest, NextResponse } from "next/server"
import { MailAgent } from "@/agents/mail-agent"
import { TrackerAgent } from "@/agents/tracker-agent"
import { JobMarketAgent } from "@/agents/job-market-agent"
import { SkillResearchAgent } from "@/agents/skill-research-agent"
import { LearningPlannerAgent } from "@/agents/learning-planner-agent"
import { SystemObserverAgent } from "@/agents/system-observer-agent"
import { getUser } from "@/lib/db"
import { EmailParsed } from "@/types"

/**
 * API Route: Trigger Mail Agent
 * POST /api/agents/mail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, emails } = body

    if (!userId || !emails) {
      return NextResponse.json(
        { error: "Missing userId or emails" },
        { status: 400 }
      )
    }

    const agent = new MailAgent(userId)
    await agent.processInboxEmails(emails as EmailParsed[])

    return NextResponse.json({
      success: true,
      message: `Processed ${emails.length} emails`,
    })
  } catch (error) {
    console.error("Mail Agent Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
