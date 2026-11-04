import { NextRequest, NextResponse } from "next/server"
import { getValidGmailAccessToken, fetchGmailEmails } from "@/lib/gmail-fetcher"
import { MailAgent } from "@/agents/mail-agent"
import { getApplications, getUser } from "@/lib/db"
import { checkRateLimit } from "@/lib/rate-limit"

async function handleSync(request: NextRequest, userIdParam?: string) {
  // Rate limit: 10 sync operations per minute per client/user
  const rateLimitResponse = checkRateLimit(request, {
    limit: 10,
    windowSeconds: 60,
    identifier: userIdParam,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    let userId = userIdParam
    if (!userId) {
      const searchParams = request.nextUrl.searchParams
      userId = searchParams.get("userId") || undefined
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 })
    }

    userId = userId.trim()
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      return NextResponse.json({ error: "Invalid userId format" }, { status: 400 })
    }

    console.log(`[api/agents/sync-inbox] Starting inbox sync for user ${userId}...`)

    // 1. Get valid access token (refreshes expired token automatically)
    const accessToken = await getValidGmailAccessToken(userId)

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "No connected Gmail account found or token could not be refreshed. Please reconnect Gmail in Settings.",
        },
        { status: 400 }
      )
    }

    // Load candidate's parsed resume and career profile to guide targeted email search
    const user = await getUser(userId)
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

    // 2. Fetch relevant emails from Gmail with resume intelligence
    const emails = await fetchGmailEmails(accessToken, 35, userContext)

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
      { error: "Failed to sync inbox. Please try again later." },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/sync-inbox?userId=<id>
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") || undefined
  return handleSync(request, userId)
}

/**
 * POST /api/agents/sync-inbox
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const userId = body.userId || request.nextUrl.searchParams.get("userId") || undefined
  return handleSync(request, userId)
}
