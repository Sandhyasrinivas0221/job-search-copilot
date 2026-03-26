import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { DashboardMetrics } from "@/types"

/**
 * API Route: Get Dashboard Metrics
 * GET /api/metrics?userId=<id>
 *
 * Computes application pipeline metrics for the user's dashboard
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

    // Fetch all applications for the user
    const { data: applications, error: appError } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("user_id", userId)

    if (appError) {
      throw new Error(`Failed to fetch applications: ${appError.message}`)
    }

    const apps = applications || []

    // Calculate date ranges
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Compute metrics
    const metrics: DashboardMetrics = {
      totalApplications: apps.length,
      applicationsThisWeek: apps.filter(
        (a) => new Date(a.created_at) >= weekAgo
      ).length,
      interviewRate:
        apps.length > 0
          ? parseFloat(
              (
                (apps.filter((a) => a.current_status === "INTERVIEW").length /
                  apps.length) *
                100
              ).toFixed(1)
            )
          : 0,
      offerRate:
        apps.length > 0
          ? parseFloat(
              (
                (apps.filter((a) => a.current_status === "OFFER").length /
                  apps.length) *
                100
              ).toFixed(1)
            )
          : 0,
      rejectionRate:
        apps.length > 0
          ? parseFloat(
              (
                (apps.filter((a) => a.current_status === "REJECTED").length /
                  apps.length) *
                100
              ).toFixed(1)
            )
          : 0,
      averageDaysToInterview:
        apps.filter((a) => a.current_status === "INTERVIEW").length > 0
          ? Math.round(
              apps
                .filter((a) => a.current_status === "INTERVIEW")
                .reduce((sum, a) => sum + a.days_in_stage, 0) /
                apps.filter((a) => a.current_status === "INTERVIEW").length
            )
          : 0,
      topCompanies: Object.entries(
        apps.reduce(
          (acc: Record<string, number>, app) => {
            acc[app.company_name] = (acc[app.company_name] || 0) + 1
            return acc
          },
          {}
        )
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([company, count]) => ({
          company,
          count,
        })),
      topRejectionReasons: [],
      learningProgress: 0,
      upcomingInterviews: apps.filter(
        (a) => a.current_status === "INTERVIEW"
      ),
      recentOffers: apps
        .filter((a) => a.current_status === "OFFER")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    }

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
