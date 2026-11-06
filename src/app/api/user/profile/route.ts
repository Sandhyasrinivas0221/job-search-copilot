import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { authenticateRequest } from "@/lib/server-auth"

export interface UserCareerProfile {
  id: string
  email: string
  full_name: string | null
  target_role: string
  target_location: string
  industry_field: string
  institution_name: string | null
  skills: string[]
  resume_summary: string | null
  is_configured: boolean
  last_updated?: string
}

const INDUSTRY_PRESETS: Record<
  string,
  { defaultRole: string; skills: string[]; defaultLocation: string }
> = {
  "Healthcare & Social Care": {
    defaultRole: "Care Worker",
    defaultLocation: "United Kingdom",
    skills: [
      "Dementia Care",
      "Safeguarding Adults",
      "Medication Administration",
      "First Aid",
      "Moving and Handling",
      "Infection Control",
      "Person-Centred Care",
      "Health and Social Care Support",
    ],
  },
  "Nursing & Clinical Healthcare": {
    defaultRole: "Registered Nurse",
    defaultLocation: "United Kingdom",
    skills: [
      "Clinical Patient Care",
      "NMC Code of Conduct",
      "Medication Administration",
      "Wound Care & Dressing",
      "Vital Signs Monitoring",
      "Care Planning & Documentation",
      "Emergency Life Support",
    ],
  },
  "Technology & Software Engineering": {
    defaultRole: "Software Engineer",
    defaultLocation: "Remote",
    skills: [
      "Full Stack Development",
      "TypeScript & React",
      "Node.js & APIs",
      "SQL & Database Design",
      "System Architecture",
      "Git & CI/CD",
      "Cloud Infrastructure",
    ],
  },
  "Education & Teaching": {
    defaultRole: "Teaching Assistant",
    defaultLocation: "United Kingdom",
    skills: [
      "Classroom Management",
      "Special Educational Needs (SEN)",
      "Safeguarding in Schools",
      "Lesson Planning & Delivery",
      "Child Development & Welfare",
      "Student Mentoring",
    ],
  },
  "Administration & Customer Service": {
    defaultRole: "Administrative Assistant",
    defaultLocation: "United Kingdom",
    skills: [
      "Office Administration",
      "Customer Communication",
      "Appointment Scheduling",
      "Microsoft Office & Google Workspace",
      "Records Management",
      "Data Accuracy & Invoicing",
    ],
  },
  "Logistics, Warehousing & Driving": {
    defaultRole: "Delivery Driver / Warehouse Operative",
    defaultLocation: "United Kingdom",
    skills: [
      "Route Navigation & Delivery",
      "Health & Safety Regulations",
      "Inventory & Order Picking",
      "Vehicle Maintenance Checks",
      "Manual Handling",
    ],
  },
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 120, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", auth.userId!)
      .maybeSingle()

    if (error) throw error

    if (!user) {
      return NextResponse.json({
        success: true,
        profile: {
          id: userId,
          email: "guest@example.com",
          full_name: "Job Candidate",
          target_role: "",
          target_location: "United Kingdom",
          industry_field: "",
          institution_name: null,
          skills: [],
          resume_summary: null,
          is_configured: false,
        },
      })
    }

    let parsedBio: any = {}
    if (user.bio) {
      try {
        parsedBio = JSON.parse(user.bio)
      } catch {
        parsedBio = { resume_summary: user.bio }
      }
    }

    const hasConfiguredRole = Boolean(parsedBio.target_role)

    const profile: UserCareerProfile = {
      id: user.id,
      email: user.email,
      full_name: user.full_name || "Job Candidate",
      target_role: parsedBio.target_role || "",
      target_location: parsedBio.target_location || "United Kingdom",
      industry_field: parsedBio.industry_field || "",
      institution_name: parsedBio.institution_name || null,
      skills: user.skills && user.skills.length > 0 ? user.skills : parsedBio.skills || [],
      resume_summary: parsedBio.resume_summary || null,
      is_configured: hasConfiguredRole,
      last_updated: user.updated_at,
    }

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error("[api/user/profile] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 30, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const {
      userId,
      email,
      full_name,
      target_role,
      target_location,
      industry_field,
      institution_name,
      skills,
      resume_summary,
    } = body

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const auth = await authenticateRequest(request, userId)
    if (!auth.authorized) return auth.response!

    const targetId = auth.userId!

    const preset = INDUSTRY_PRESETS[industry_field]
    const finalRole = target_role || preset?.defaultRole || "Candidate"
    const finalLocation = target_location || preset?.defaultLocation || "United Kingdom"
    const finalField = industry_field || "General Professional"
    const finalSkills =
      Array.isArray(skills) && skills.length > 0 ? skills : preset?.skills || []

    const bioPayload = JSON.stringify({
      target_role: finalRole,
      target_location: finalLocation,
      industry_field: finalField,
      institution_name: institution_name || null,
      resume_summary: resume_summary || null,
    })

    const upsertPayload: Record<string, any> = {
      id: targetId,
      email: email || `user-${targetId.substring(0, 8)}@jobcopilot.local`,
      bio: bioPayload,
      skills: finalSkills,
      updated_at: new Date().toISOString(),
    }

    if (full_name) upsertPayload.full_name = full_name

    const { data: updated, error } = await supabaseAdmin
      .from("users")
      .upsert(upsertPayload, { onConflict: "id" })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Career profile updated successfully",
      user: updated,
    })
  } catch (error) {
    console.error("[api/user/profile] Error updating profile:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
