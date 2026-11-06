import { NextRequest, NextResponse } from "next/server"
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  createStatusHistory,
} from "@/lib/db"
import { ApplicationStatus, Application } from "@/types"
import { checkRateLimit } from "@/lib/rate-limit"
import { authenticateRequest } from "@/lib/server-auth"

/**
 * Sanitizes application data before sending over the wire.
 * Strips raw email bodies and personal data to prevent privacy leakage.
 */
function sanitizeApplication(app: Application): Application {
  if (!app) return app

  let cleanDesc = app.description || null
  if (cleanDesc) {
    // If description contains raw email fragments or headers, sanitize to a safe summary
    if (
      /from:|subject:|to:|reply-to:|delivered-to:|message-id:|received:|dear\s+[a-z]+/i.test(
        cleanDesc
      ) ||
      cleanDesc.includes("@") ||
      cleanDesc.length > 300
    ) {
      cleanDesc = `${app.job_title} application at ${app.company_name}`
    }
  }

  return {
    ...app,
    description: cleanDesc,
  }
}

/**
 * API Route: Applications CRUD
 * GET    /api/applications?userId=<id>
 * POST   /api/applications (body: { userId, company_name, job_title, ... })
 * PATCH  /api/applications (body: { id, userId, current_status, ... })
 * DELETE /api/applications?id=<id>&userId=<userId>
 */

export async function GET(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 120, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    // Authenticate caller - prevents any stranger on internet from querying victim's data
    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const applications = await getApplications(auth.userId!)
    const sanitized = applications.map(sanitizeApplication)

    return NextResponse.json({
      success: true,
      applications: sanitized,
    })
  } catch (error) {
    console.error("Applications GET Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch applications" },
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

    // Authenticate caller
    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    // Prevent sender email addresses from being stored as company_name
    let safeCompany = String(company_name).trim().substring(0, 100)
    if (safeCompany.includes("@") || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(safeCompany)) {
      safeCompany = "Direct Employer"
    }

    const safeTitle = String(job_title).trim().substring(0, 150)
    const safeLocation = location ? String(location).trim().substring(0, 100) : null
    
    // Sanitize description so raw email bodies are not stored
    let safeDescription = description ? String(description).substring(0, 300) : null
    if (safeDescription && safeDescription.includes("@")) {
      safeDescription = `${safeTitle} application at ${safeCompany}`
    }

    const newApp = await createApplication({
      user_id: auth.userId!,
      company_name: safeCompany,
      job_title: safeTitle,
      current_status,
      location: safeLocation,
      salary_min: salary_min ? Number(salary_min) : null,
      salary_max: salary_max ? Number(salary_max) : null,
      job_url: job_url ? String(job_url).substring(0, 500) : null,
      description: safeDescription,
      source_site: String(source_site).substring(0, 50),
      easy_apply: Boolean(easy_apply),
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

    // Log status history without sensitive email bodies
    await createStatusHistory({
      application_id: newApp.id,
      user_id: auth.userId!,
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
      application: sanitizeApplication(newApp),
    })
  } catch (error) {
    console.error("Applications POST Error:", error)
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 60, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { id, userId, current_status, notes, ...updates } = body

    if (!id || !userId) {
      return NextResponse.json(
        { error: "id and userId are required to update application" },
        { status: 400 }
      )
    }

    // Authenticate caller
    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const payload: Record<string, any> = {
      ...updates,
      last_update: new Date().toISOString(),
    }

    if (current_status) {
      payload.current_status = current_status
      payload.days_in_stage = 0
    }

    // Verify ownership via authenticated userId
    const updated = await updateApplication(id, payload, auth.userId!)

    if (!updated) {
      return NextResponse.json(
        { error: "Application not found or unauthorized to update" },
        { status: 404 }
      )
    }

    if (current_status) {
      await createStatusHistory({
        application_id: id,
        user_id: auth.userId!,
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
      application: sanitizeApplication(updated),
    })
  } catch (error) {
    console.error("Applications PATCH Error:", error)
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 30, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")
    const userId = searchParams.get("userId")

    if (!id || !userId) {
      return NextResponse.json(
        { error: "Missing application id or userId" },
        { status: 400 }
      )
    }

    // Authenticate caller
    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const ok = await deleteApplication(id, auth.userId!)
    return NextResponse.json({ success: ok })
  } catch (error) {
    console.error("Applications DELETE Error:", error)
    return NextResponse.json(
      { error: "Failed to delete application" },
      { status: 500 }
    )
  }
}
