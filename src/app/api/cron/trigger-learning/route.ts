import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { LearningPlannerAgent } from "@/agents/learning-planner-agent"
import { getTrendingSkills } from "@/lib/db"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCronAuthorization } from "@/lib/auth-guard"

export async function POST(request: NextRequest) {
  const authCheck = await verifyCronAuthorization(request)
  if (!authCheck.authorized) return authCheck.response!

  const rateLimitResponse = checkRateLimit(request, { limit: 15, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      return NextResponse.json(
        { error: "Missing or invalid userId parameter" },
        { status: 400 }
      )
    }

    console.log(`[trigger/learning] Starting learning plan generation for user ${userId}`)

    // Get trending skills to verify we have data
    const trendingSkills = await getTrendingSkills(userId)
    console.log(`[trigger/learning] Found ${trendingSkills.length} trending skills`)

    if (trendingSkills.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No trending skills detected yet",
          tasksCreated: 0,
          skills: [],
          note: "Run skill detection first (SkillResearchAgent). Learning tasks can only be created for trending skills.",
          tasksGenerated: [],
        },
        { status: 200 }
      )
    }

    // Instantiate and run the Learning Planner Agent
    const agent = new LearningPlannerAgent(userId)
    const learningPlans = await agent.generateWeeklyLearningPlan()

    console.log(
      `[trigger/learning] Generated learning plans for ${learningPlans.length} skill categories`
    )

    // Get created tasks to return to user
    const { data: createdTasks, error: tasksError } = await supabaseAdmin
      .from("learning_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (tasksError) {
      console.error(`[trigger/learning] Error fetching created tasks:`, tasksError)
    }

    return NextResponse.json({
      success: true,
      message: "Learning plan generated successfully",
      tasksCreated: createdTasks?.length || 0,
      skills: trendingSkills.map((s) => ({
        name: s.skill_name,
        category: s.skill_category,
        frequency: s.frequency,
        trending: s.rising_trend,
      })),
      tasksGenerated: (createdTasks || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        topic: task.topic,
        priority: task.priority,
        estimatedHours: task.estimated_hours,
        dueDate: task.due_date,
        resources: task.resources ? task.resources.slice(0, 3) : [],
      })),
    })
  } catch (error) {
    console.error("[trigger/learning] Error generating learning plan:", error)
    return NextResponse.json(
      {
        error: "Failed to generate learning plan",
      },
      { status: 500 }
    )
  }
}
