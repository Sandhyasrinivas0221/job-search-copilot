import { NextRequest, NextResponse } from "next/server"
import { getValidGmailAccessToken, fetchGmailEmails } from "@/lib/gmail-fetcher"
import { MailAgent } from "@/agents/mail-agent"
import { getApplications } from "@/lib/db"

/**
 * POST /api/agents/sync-inbox
 * Manually or programmatically triggers an immediate inbox scan for job applications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const searchParams = request.nextUrl.searchParams
    const userId = body.userId || searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    console.log(`[api/agents/sync-inbox] Starting inbox sync for user ${userId}...`)

    // 1. Get valid access token (refreshes expired token automatically)
    const accessToken = await getValidGmailAccessToken(userId)

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: "No connected Gmail account found or token could not be refreshed. Please reconnect Gmail in Settings.",
      }, { status: 400 })
    }

    // 2. Fetch relevant emails from Gmail
    const emails = await fetchGmailEmails(accessToken, 35)

    if (emails.length === 0) {
      const currentApps = await getApplications(userId)
      return NextResponse.json({
        success: true,
        message: "Inbox scanned successfully. No new job application emails found.",
        applications: currentApps,
        emailsChecked: 0,
        syncedCount: 0,
      })
    }

    // 3. Process through MailAgent
    const mailAgent = new MailAgent(userId)
    const processed = await mailAgent.processInboxEmails(emails)

    // 4. Return updated applications list
    const updatedApps = await getApplications(userId)

    return NextResponse.json({
      success: true,
      message: `Inbox scanned successfully! Checked ${emails.length} emails.`,
      emailsChecked: emails.length,
      syncedCount: processed.length,
      applications: updatedApps,
    })
  } catch (error) {
    console.error("[api/agents/sync-inbox] Error syncing inbox:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
