import { NextRequest, NextResponse } from "next/server"
import { LearningPathService, LearningPathRecommendation } from "@/lib/learning-path-service"
import { supabaseAdmin } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 15, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      return NextResponse.json({ error: "Missing or invalid userId parameter" }, { status: 400 })
    }

    console.log(`[trigger/learning-paths] Starting learning path analysis for user ${userId}`)

    // Initialize learning path service
    const service = new LearningPathService(userId)
    await service.initialize()

    // Generate recommendations for all active applications
    const recommendations: LearningPathRecommendation[] =
      await service.generateRecommendationsForAllApplications()

    console.log(
      `[trigger/learning-paths] Generated ${recommendations.length} learning path recommendations`
    )

    // Format response with detailed insights
    const formattedRecommendations = recommendations.map((rec) => ({
      jobId: rec.jobId,
      jobTitle: rec.jobTitle,
      company: rec.company,
      priority: rec.priority,
      totalEstimatedHours: rec.totalEstimatedHours,
      reasoning: rec.reasoning,
      skillGapsCount: rec.skillGaps.length,
      skillGaps: rec.skillGaps.map((gap) => ({
        skillName: gap.skillName,
        category: gap.skillCategory,
        marketFrequency: gap.marketFrequency,
      })),
      targetSkillPaths: rec.targetSkillPaths.map((p) => ({
        skillName: p.skill.skillName,
        difficulty: p.difficulty,
        estimatedHours: p.estimatedHours,
        relevanceScore: p.relevanceScore,
        resourcesCount: p.resources.length,
      })),
      transitionRoles: rec.transitionRoles,
    }))

    // Save recommendations as learning tasks to database
    try {
      for (const rec of recommendations) {
        for (const path of rec.targetSkillPaths) {
          const { error: taskError } = await supabaseAdmin.from("learning_tasks").insert([
            {
              user_id: userId,
              title: `Master ${path.skill.skillName}`,
              topic: path.skill.skillCategory || "Skill Development",
              priority: rec.priority === "CRITICAL" ? "HIGH" : rec.priority,
              estimated_hours: path.estimatedHours,
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              resources: path.resources,
              completed: false,
            },
          ])

          if (taskError) {
            console.warn(`[trigger/learning-paths] Could not save task for ${path.skill.skillName}`)
          }
        }
      }
    } catch (saveError) {
      console.warn("[trigger/learning-paths] Could not persist tasks to database:", saveError)
    }

    return NextResponse.json({
      success: true,
      message: "Learning paths analyzed successfully",
      userId,
      recommendationsCount: recommendations.length,
      recommendations: formattedRecommendations,
      marketInsights: {
        analyzedJobsCount: recommendations.length,
        topTrendingSkills: extractTopTrends(recommendations),
      },
    })
  } catch (error) {
    console.error("[trigger/learning-paths] Error generating recommendations:", error)
    return NextResponse.json(
      {
        error: "Failed to generate learning path recommendations",
      },
      { status: 500 }
    )
  }
}

/**
 * Extract top trending skills from recommendations
 */
function extractTopTrends(recommendations: LearningPathRecommendation[]): string[] {
  const skillFreq = new Map<string, number>()

  for (const rec of recommendations) {
    for (const gap of rec.skillGaps) {
      skillFreq.set(gap.skillName, (skillFreq.get(gap.skillName) || 0) + gap.marketFrequency)
    }
  }

  return Array.from(skillFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill]) => skill)
}
