import { NextRequest, NextResponse } from "next/server"
import { getJobSuggestions } from "@/lib/db"

/**
 * API Route: Get Job Suggestions
 * GET /api/suggestions?userId=<id>&applied=<true|false>&dismissed=<true|false>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const applied = searchParams.get("applied") === "false" ? false : true
    const dismissed = searchParams.get("dismissed") === "false" ? false : true

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const suggestions = await getJobSuggestions(userId, !applied, !dismissed)

    return NextResponse.json({
      success: true,
      suggestions,
    })
  } catch (error) {
    console.error("Suggestions API Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
