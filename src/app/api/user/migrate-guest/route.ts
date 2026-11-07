import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { authenticateRequest } from "@/lib/server-auth"
import { getOrCreateUser } from "@/lib/db"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

/**
 * POST /api/user/migrate-guest
 * Migrates temporary guest data (applications, suggestions, learning tasks, resumes)
 * into a permanent authenticated user account upon sign-up or sign-in.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, { limit: 10, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { guestUserId } = body

    if (!guestUserId || typeof guestUserId !== "string") {
      return NextResponse.json({ error: "guestUserId is required" }, { status: 400 })
    }

    // Authenticate the destination user via Bearer JWT
    const auth = await authenticateRequest(request)
    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "A valid user session is required to migrate data." },
        { status: 401 }
      )
    }

    const permanentUserId = auth.userId

    // Cannot migrate to self or invalid UUID
    if (guestUserId === permanentUserId) {
      return NextResponse.json({ success: true, message: "Guest and permanent user are identical." })
    }

    console.log(`[migrate-guest] Migrating data from guest ${guestUserId} -> user ${permanentUserId}`)

    // Guarantee the permanent user exists in public.users before re-pointing foreign keys
    await getOrCreateUser(permanentUserId)

    // 1. Migrate Applications
    const { count: appCount } = await supabaseAdmin
      .from("applications")
      .update({ user_id: permanentUserId })
      .eq("user_id", guestUserId)

    // 2. Migrate Job Suggestions
    const { count: sugCount } = await supabaseAdmin
      .from("job_suggestions")
      .update({ user_id: permanentUserId })
      .eq("user_id", guestUserId)

    // 3. Migrate Learning Tasks
    const { count: taskCount } = await supabaseAdmin
      .from("learning_tasks")
      .update({ user_id: permanentUserId })
      .eq("user_id", guestUserId)

    // 4. Migrate Resumes
    const { count: resumeCount } = await supabaseAdmin
      .from("resumes")
      .update({ user_id: permanentUserId })
      .eq("user_id", guestUserId)

    // 5. Migrate Email Credentials (if any)
    const { count: emailCredsCount } = await supabaseAdmin
      .from("email_credentials")
      .update({ user_id: permanentUserId })
      .eq("user_id", guestUserId)

    // 6. Merge Guest Profile skills if permanent profile has none
    const { data: guestUser } = await supabaseAdmin
      .from("users")
      .select("skills, bio")
      .eq("id", guestUserId)
      .single()

    if (guestUser && (guestUser.skills?.length > 0 || guestUser.bio)) {
      const { data: permUser } = await supabaseAdmin
        .from("users")
        .select("skills, bio")
        .eq("id", permanentUserId)
        .single()

      const updates: any = {}
      if ((!permUser?.skills || permUser.skills.length === 0) && guestUser.skills?.length > 0) {
        updates.skills = guestUser.skills
      }
      if (!permUser?.bio && guestUser.bio) {
        updates.bio = guestUser.bio
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("users").update(updates).eq("id", permanentUserId)
      }
    }

    // Clean up temporary guest user row
    await supabaseAdmin.from("users").delete().eq("id", guestUserId)

    return NextResponse.json({
      success: true,
      message: "Guest data successfully migrated to permanent account.",
      migrated: {
        applications: appCount || 0,
        suggestions: sugCount || 0,
        tasks: taskCount || 0,
        resumes: resumeCount || 0,
        credentials: emailCredsCount || 0,
      },
    })
  } catch (err: any) {
    console.error("[migrate-guest] Migration error:", err)
    return NextResponse.json({ error: "Failed to migrate guest data", details: err.message }, { status: 500 })
  }
}
