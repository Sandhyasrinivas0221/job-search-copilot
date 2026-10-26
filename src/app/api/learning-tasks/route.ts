import { NextRequest, NextResponse } from "next/server"
import { getLearningTasks, updateLearningTask, createLearningTask } from "@/lib/db"

/**
 * API Route: Learning Tasks
 * GET   /api/learning-tasks?userId=<id>&completed=<true|false>
 * PATCH /api/learning-tasks (body: { id, completed?: boolean, priority?: string, ... })
 * POST  /api/learning-tasks (body: { userId, title, topic, estimated_hours, priority, ... })
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
    console.error("Learning Tasks GET Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, completed, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: "Missing task id" },
        { status: 400 }
      )
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
      { error: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const newTask = await createLearningTask({
      user_id: userId,
      application_id: null,
      title,
      description: description || null,
      topic: topic || null,
      difficulty_level,
      estimated_hours: estimated_hours ? Number(estimated_hours) : 2,
      resources: Array.isArray(resources) ? resources : [resources],
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
      { error: String(error) },
      { status: 500 }
    )
  }
}
