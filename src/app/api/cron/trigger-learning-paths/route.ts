/**
 * Phase 5: Learning Path Service Trigger Endpoint
 *
 * Analyzes active job applications and generates personalized learning path recommendations
 * Extracts job context from applications, identifies skill gaps, and suggests structured learning
 *
 * Endpoint: POST /api/cron/trigger-learning-paths?userId=<id>
 *
 * Response includes:
 * - Recommended learning paths for each active application
 * - Skill gaps analysis
 * - Market trends & demand analysis
 * - Transition role suggestions
 * - Prioritized learning tasks
 */

import { NextRequest, NextResponse } from "next/server"
import { LearningPathService } from "@/lib/learning-path-service"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 })
    }

    console.log(`[trigger/learning-paths] Starting learning path analysis for user ${userId}`)

    // Initialize learning path service
    const service = new LearningPathService(userId)
    await service.initialize()

    // Generate recommendations for all active applications
    const recommendations = await service.generateRecommendationsForAllApplications()

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
      skillGaps: rec.skillGaps.map((gap) => ({
        name: gap.skillName,
        category: gap.skillCategory,
        priority: gap.priority,
        marketFrequency: gap.marketFrequency,
        estimatedHours: gap.estimatedHoursToAcquire,
        topResources: gap.resources.slice(0, 2).map((r) => ({
          title: r.title,
          url: r.url,
          type: r.type,
          platform: r.platform,
          estimatedHours: r.estimatedHours,
        })),
      })),
      recommendedSkills: rec.targetSkillPaths.slice(0, 3).map((sp) => ({
        skillName: sp.skill.skillName,
        category: sp.skill.skillCategory,
        difficulty: sp.difficulty,
        relevanceScore: sp.relevanceScore,
        estimatedHours: sp.estimatedHours,
        resources: sp.resources.slice(0, 2).map((r) => ({
          title: r.title,
          url: r.url,
          type: r.type,
          platform: r.platform,
        })),
      })),
      transitionRoles: rec.transitionRoles.map((tr) => ({
        title: tr.title,
        description: tr.description,
        skillMatch: tr.currentSkillMatch,
        estimatedMonths: tr.estimatedMonthsToTransition,
      })),
      marketContext: {
        demandLevel: rec.marketDemand.demandLevel,
        trends: rec.marketDemand.trendsAnalysis,
      },
    }))

    return NextResponse.json({
      success: true,
      message: "Learning path analysis completed",
      applicationsAnalyzed: recommendations.length,
      recommendations: formattedRecommendations,
      summary: {
        highPriorityJobs: recommendations.filter((r) => r.priority === "CRITICAL" || r.priority === "HIGH")
          .length,
        totalLearningHours: recommendations.reduce((sum, r) => sum + r.totalEstimatedHours, 0),
        averageSkillGaps: Math.round(
          recommendations.reduce((sum, r) => sum + r.skillGaps.length, 0) / Math.max(recommendations.length, 1)
        ),
        topTrendingSkills: extractTopTrends(recommendations),
      },
    })
  } catch (error) {
    console.error("[trigger/learning-paths] Error generating learning paths:", error)
    return NextResponse.json(
      {
        error: "Failed to generate learning paths",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Extract top trending skills from recommendations
 */
function extractTopTrends(recommendations: any[]): string[] {
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
