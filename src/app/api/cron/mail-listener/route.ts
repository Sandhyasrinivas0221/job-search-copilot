/**
 * Vercel Cron: Mail Listener Agent
 *
 * Route: /api/cron/mail-listener
 * Schedule: Every 5 minutes (cron expression: every 5 * * * *)
 *
 * Triggered automatically by Vercel at the specified schedule
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { MailAgent } from "@/agents/mail-agent"
import { fetchGmailEmails } from "@/lib/gmail-fetcher"

export const runtime = "nodejs"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

// Vercel automatically calls this when the cron schedule is triggered
export async function GET(request: NextRequest) {
  // TEST DATA: Skip auth check in development for manual testing (COMMENTED OUT FOR PRODUCTION)
  // if (process.env.NODE_ENV === "production") {
  //   const authHeader = request.headers.get("authorization")
  //   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  //   }
  // }

  // PRODUCTION: Always require CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[mail-listener] Unauthorized cron request - missing/invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[cron/mail-listener] Starting mail listener agent")

    // Get all users with Gmail credentials connected
    const { data: emailCreds, error: credsError } = await supabaseAdmin
      .from("email_credentials")
      .select("*")
      .eq("provider", "gmail")
      .eq("is_connected", true)

    if (credsError) {
      console.error("[cron/mail-listener] Failed to fetch email credentials:", credsError)
      return NextResponse.json({ error: String(credsError) }, { status: 500 })
    }

    if (!emailCreds || emailCreds.length === 0) {
      console.log("[cron/mail-listener] No Gmail credentials configured. Skipping.")
      return NextResponse.json({
        ok: true,
        message: "No Gmail credentials found",
        processed: 0,
        timestamp: new Date().toISOString(),
      })
    }

    console.log(
      `[cron/mail-listener] Found ${emailCreds.length} users with Gmail connected. Processing...`
    )

    let totalEmailsProcessed = 0

    // Process each user's emails
    for (const cred of emailCreds) {
      try {
        console.log(`[cron/mail-listener] Processing emails for user ${cred.user_id}`)

        // Use the access token from the credential
        const accessToken = cred.gmail_access_token

        if (!accessToken) {
          console.warn(`[cron/mail-listener] No access token for user ${cred.user_id}. Skipping.`)
          continue
        }

        // Fetch emails from Gmail
        const emails = await fetchGmailEmails(accessToken, 20)

        if (emails.length === 0) {
          console.log(`[cron/mail-listener] No new emails for user ${cred.user_id}`)
          continue
        }

        console.log(`[cron/mail-listener] Processing ${emails.length} emails for user ${cred.user_id}`)

        // Create Mail Agent and process emails
        const mailAgent = new MailAgent(cred.user_id)
        try {
          await mailAgent.processInboxEmails(emails)
          console.log(`[cron/mail-listener] Successfully processed ${emails.length} emails for user ${cred.user_id}`)
        } catch (agentError) {
          console.error(`[cron/mail-listener] Mail Agent processing error:`, agentError)
          throw agentError
        }

        totalEmailsProcessed += emails.length
      } catch (userError) {
        console.error(`[cron/mail-listener] Error processing user ${cred.user_id}:`, userError)
        // Continue with next user even if this one fails
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Mail listener agent executed successfully",
      usersProcessed: emailCreds.length,
      emailsProcessed: totalEmailsProcessed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[cron/mail-listener] Error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
