import { NextRequest, NextResponse } from "next/server"
import { getLearningTasks, updateLearningTask, createLearningTask } from "@/lib/db"
import { checkRateLimit } from "@/lib/rate-limit"
import { authenticateRequest } from "@/lib/server-auth"

/**
 * API Route: Learning Tasks
 * GET   /api/learning-tasks?userId=<id>&completed=<true|false>
 * PATCH /api/learning-tasks (body: { id, userId, completed?: boolean, priority?: string, ... })
 * POST  /api/learning-tasks (body: { userId, title, topic, estimated_hours, priority, ... })
 */

export async function GET(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 120, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

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

    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const tasks = await getLearningTasks(auth.userId!, completedOnly)

    return NextResponse.json({
      success: true,
      tasks,
    })
  } catch (error) {
    console.error("Learning Tasks GET Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch learning tasks" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 60, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { id, userId, completed, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: "Missing task id" },
        { status: 400 }
      )
    }

    if (userId) {
      const auth = await authenticateRequest(request, userId)
      if (!auth.authorized) return auth.response!
    }

    const payload: Record<string, any> = { ...updates }
    if (typeof completed === "boolean") {
      payload.completed = completed
      payload.completed_at = completed ? new Date().toISOString() : null
    }

    const updated = await updateLearningTask(id, payload)

    return NextResponse.json({
      success: true,
      task: updated,
    })
  } catch (error) {
    console.error("Learning Tasks PATCH Error:", error)
    return NextResponse.json(
      { error: "Failed to update learning task" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 30, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const {
      userId,
      title,
      description,
      topic,
      difficulty_level = "INTERMEDIATE",
      estimated_hours = 2,
      priority = "MEDIUM",
      resources = [],
      due_date,
    } = body

    if (!userId || !title) {
      return NextResponse.json(
        { error: "userId and title are required" },
        { status: 400 }
      )
    }

    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const newTask = await createLearningTask({
      user_id: auth.userId!,
      application_id: null,
      title: String(title).substring(0, 150),
      description: description ? String(description).substring(0, 2000) : null,
      topic: topic ? String(topic).substring(0, 100) : null,
      difficulty_level,
      estimated_hours: estimated_hours ? Number(estimated_hours) : 2,
      resources: Array.isArray(resources) ? resources.slice(0, 10) : [resources],
      notes: null,
      completed: false,
      completed_at: null,
      due_date: due_date || null,
      priority: priority || "MEDIUM",
    })

    return NextResponse.json({
      success: true,
      task: newTask,
    })
  } catch (error) {
    console.error("Learning Tasks POST Error:", error)
    return NextResponse.json(
      { error: "Failed to create learning task" },
      { status: 500 }
    )
  }
}
