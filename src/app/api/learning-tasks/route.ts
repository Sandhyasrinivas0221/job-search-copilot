import { NextRequest, NextResponse } from "next/server"
import { getLearningTasks } from "@/lib/db"

/**
 * API Route: Get Learning Tasks
 * GET /api/learning-tasks?userId=<id>&completed=<true|false>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const completedOnly = searchParams.get("completed") === "true"

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const tasks = await getLearningTasks(userId, completedOnly)

    return NextResponse.json({
      success: true,
      tasks,
    })
  } catch (error) {
    console.error("Learning Tasks API Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
