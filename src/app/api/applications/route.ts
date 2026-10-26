import { NextRequest, NextResponse } from "next/server"
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  createStatusHistory,
} from "@/lib/db"
import { ApplicationStatus } from "@/types"

/**
 * API Route: Applications CRUD
 * GET    /api/applications?userId=<id>
 * POST   /api/applications (body: { userId, company_name, job_title, ... })
 * PATCH  /api/applications (body: { id, userId, current_status, ... })
 * DELETE /api/applications?id=<id>
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
    console.error("Applications GET Error:", error)
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
      company_name,
      job_title,
      current_status = ApplicationStatus.APPLIED,
      location,
      salary_min,
      salary_max,
      job_url,
      description,
      source_site = "Manual",
      easy_apply = false,
      applied_date = new Date().toISOString(),
    } = body

    if (!userId || !company_name || !job_title) {
      return NextResponse.json(
        { error: "userId, company_name, and job_title are required" },
        { status: 400 }
      )
    }

    const newApp = await createApplication({
      user_id: userId,
      company_name,
      job_title,
      current_status,
      location: location || null,
      salary_min: salary_min ? Number(salary_min) : null,
      salary_max: salary_max ? Number(salary_max) : null,
      job_url: job_url || null,
      description: description || null,
      source_site,
      easy_apply,
      applied_date,
      last_update: new Date().toISOString(),
      days_in_stage: 0,
    })

    if (!newApp) {
      return NextResponse.json(
        { error: "Failed to create application" },
        { status: 500 }
      )
    }

    // Log status history
    await createStatusHistory({
      application_id: newApp.id,
      user_id: userId,
      old_status: null,
      new_status: current_status,
      reason: "Application created",
      notes: null,
      email_subject: null,
      email_body: null,
      detected_by: "USER",
    })

    return NextResponse.json({
      success: true,
      application: newApp,
    })
  } catch (error) {
    console.error("Applications POST Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, current_status, notes, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: "id is required to update application" },
        { status: 400 }
      )
    }

    const payload: Record<string, any> = {
      ...updates,
      last_update: new Date().toISOString(),
    }

    if (current_status) {
      payload.current_status = current_status
      payload.days_in_stage = 0
    }

    const updated = await updateApplication(id, payload)

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update application" },
        { status: 500 }
      )
    }

    if (current_status && userId) {
      await createStatusHistory({
        application_id: id,
        user_id: userId,
        old_status: null,
        new_status: current_status,
        reason: notes || `Status changed to ${current_status}`,
        notes: notes || null,
        email_subject: null,
        email_body: null,
        detected_by: "USER",
      })
    }

    return NextResponse.json({
      success: true,
      application: updated,
    })
  } catch (error) {
    console.error("Applications PATCH Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Missing application id" },
        { status: 400 }
      )
    }

    const ok = await deleteApplication(id)
    return NextResponse.json({ success: ok })
  } catch (error) {
    console.error("Applications DELETE Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
