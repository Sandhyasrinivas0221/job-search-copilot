import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

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
  last_updated?: string
}

const DEFAULT_PROFILE = {
  target_role: "Care Worker",
  target_location: "United Kingdom",
  industry_field: "Healthcare & Social Care",
  institution_name: null,
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
  resume_summary: null,
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    if (error) throw error

    if (!user) {
      return NextResponse.json({
        success: true,
        profile: { id: userId, email: "user@example.com", ...DEFAULT_PROFILE },
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

    const profile: UserCareerProfile = {
      id: user.id,
      email: user.email,
      full_name: user.full_name || "Job Candidate",
      target_role: parsedBio.target_role || DEFAULT_PROFILE.target_role,
      target_location: parsedBio.target_location || DEFAULT_PROFILE.target_location,
      industry_field: parsedBio.industry_field || DEFAULT_PROFILE.industry_field,
      institution_name: parsedBio.institution_name || null,
      skills:
        user.skills && user.skills.length > 0
          ? user.skills
          : parsedBio.skills || DEFAULT_PROFILE.skills,
      resume_summary: parsedBio.resume_summary || null,
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
  try {
    const body = await request.json()
    const {
      userId,
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

    const bioPayload = JSON.stringify({
      target_role: target_role || DEFAULT_PROFILE.target_role,
      target_location: target_location || DEFAULT_PROFILE.target_location,
      industry_field: industry_field || DEFAULT_PROFILE.industry_field,
      institution_name: institution_name || null,
      resume_summary: resume_summary || null,
    })

    const updates: Record<string, any> = {
      bio: bioPayload,
      updated_at: new Date().toISOString(),
    }

    if (full_name) updates.full_name = full_name
    if (Array.isArray(skills)) updates.skills = skills

    const { data: updated, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userId)
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
