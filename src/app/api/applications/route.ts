import { NextRequest, NextResponse } from "next/server"
import { getApplications } from "@/lib/db"

/**
 * API Route: Get Applications
 * GET /api/applications?userId=<id>
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

    const applications = await getApplications(userId)

    return NextResponse.json({
      success: true,
      applications,
    })
  } catch (error) {
    console.error("Applications API Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
