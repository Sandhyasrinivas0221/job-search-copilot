/**
 * Vercel Cron: Mail Listener Agent
 *
 * Route: /api/cron/mail-listener
 * Schedule: Every 5 minutes
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { MailAgent } from "@/agents/mail-agent"
import { fetchGmailEmails, getValidGmailAccessToken } from "@/lib/gmail-fetcher"
import { getUser } from "@/lib/db"
import { verifyCronAuthorization } from "@/lib/auth-guard"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const authCheck = await verifyCronAuthorization(request)
  if (!authCheck.authorized) return authCheck.response!

  const rateLimitResponse = checkRateLimit(request, { limit: 20, windowSeconds: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    console.log("[cron/mail-listener] Starting scheduled mail listener check...")

    // If user triggered, only check that specific user's credentials; otherwise global cron check
    let query = supabaseAdmin
      .from("email_credentials")
      .select("user_id, email_address")
      .eq("provider", "gmail")
      .eq("is_connected", true)

    if (authCheck.authenticatedUserId) {
      query = query.eq("user_id", authCheck.authenticatedUserId)
    }

    const { data: emailCreds, error: credsError } = await query

    if (credsError || !emailCreds || emailCreds.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No connected Gmail credentials found",
        processed: 0,
      })
    }

    let totalProcessed = 0

    for (const cred of emailCreds) {
      try {
        const accessToken = await getValidGmailAccessToken(cred.user_id)
        if (!accessToken) continue

        // Load user's career context from resume
        const user = await getUser(cred.user_id)
        let userContext: any = undefined
        if (user?.bio) {
          try {
            const bio = JSON.parse(user.bio)
            userContext = {
              targetRole: bio.target_role,
              industryField: bio.industry_field,
              searchKeywords: bio.search_keywords,
            }
          } catch {}
        }

        const emails = await fetchGmailEmails(accessToken, 25, userContext)
        if (emails.length === 0) continue

        const agent = new MailAgent(cred.user_id)
        const apps = await agent.processInboxEmails(emails)
        totalProcessed += apps.length
      } catch (userErr) {
        console.error(`[cron/mail-listener] Error processing user ${cred.user_id}:`, userErr)
      }
    }

    return NextResponse.json({
      ok: true,
      processed: totalProcessed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[cron/mail-listener] Fatal error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
