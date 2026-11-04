/**
 * Gmail Email Fetcher with automatic OAuth token refresh
 */

import { EmailParsed } from "@/types"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Ensures a valid access token by refreshing if needed using the refresh token
 */
export async function getValidGmailAccessToken(userId: string): Promise<string | null> {
  try {
    const { data: cred, error } = await supabaseAdmin
      .from("email_credentials")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .eq("is_connected", true)
      .maybeSingle()

    if (error || !cred) {
      console.warn(`[gmail-fetcher] No connected Gmail credential for user ${userId}`)
      return null
    }

    // Check if token is still valid (with 5 minute buffer)
    const expiry = cred.gmail_token_expiry ? new Date(cred.gmail_token_expiry).getTime() : 0
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (cred.gmail_access_token && expiry > now + fiveMinutes) {
      return cred.gmail_access_token
    }

    // If no refresh token, return existing token
    if (!cred.gmail_refresh_token) {
      console.warn(`[gmail-fetcher] No refresh token found for user ${userId}`)
      return cred.gmail_access_token
    }

    // Refresh the access token from Google OAuth
    console.log(`[gmail-fetcher] Refreshing expired Gmail access token for ${cred.email_address}...`)
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: cred.gmail_refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error("[gmail-fetcher] Failed to refresh token:", errorText)
      return cred.gmail_access_token
    }

    const tokenData = await tokenResponse.json()
    const newAccessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in || 3600
    const newExpiry = new Date(now + expiresIn * 1000).toISOString()

    // Update in database
    await supabaseAdmin
      .from("email_credentials")
      .update({
        gmail_access_token: newAccessToken,
        gmail_token_expiry: newExpiry,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", cred.id)

    console.log(`[gmail-fetcher] Successfully refreshed Gmail access token for ${cred.email_address}`)
    return newAccessToken
  } catch (err) {
    console.error("[gmail-fetcher] Error refreshing access token:", err)
    return null
  }
}

/**
 * Extracts plain text from Gmail multipart MIME message
 */
function extractBodyFromPayload(payload: any): string {
  if (!payload) return ""

  // Direct body
  if (payload.body && payload.body.data) {
    const raw = Buffer.from(payload.body.data, "base64").toString("utf-8")
    return cleanHtml(raw)
  }

  // Search parts
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain")
    if (textPart && textPart.body && textPart.body.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8")
    }

    // Fallback to text/html
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html")
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      const rawHtml = Buffer.from(htmlPart.body.data, "base64").toString("utf-8")
      return cleanHtml(rawHtml)
    }

    // Recursive search in nested parts
    for (const part of payload.parts) {
      const text = extractBodyFromPayload(part)
      if (text) return text
    }
  }

  return ""
}

function cleanHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&zwnj;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&bull;/gi, "•")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Fetch emails relevant to job applications, interviews, and updates
 */
export async function fetchGmailEmails(
  gmailAccessToken: string,
  limit: number = 25
): Promise<EmailParsed[]> {
  try {
    console.log("[gmail-fetcher] Searching emails for job applications and updates...")

    // Broad query targeting all major job boards and application keywords
    const query = encodeURIComponent(
      "from:indeed.com OR from:indeedapply@indeed.com OR from:reed.co.uk OR from:totaljobs.com OR from:linkedin.com OR from:glassdoor.com OR from:nhs.jobs OR subject:application OR subject:applied OR subject:interview OR subject:offer OR subject:candidate OR subject:assessment"
    )

    const listResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=${query}`,
      {
        headers: {
          Authorization: `Bearer ${gmailAccessToken}`,
        },
      }
    )

    if (!listResponse.ok) {
      console.error("[gmail-fetcher] Failed to query message list:", listResponse.statusText)
      return []
    }

    const listData = await listResponse.json()
    let messages = listData.messages || []

    // If no specific job board messages found, fallback to recent messages
    if (messages.length === 0) {
      console.log("[gmail-fetcher] No filtered job emails found, fetching recent messages...")
      const fallbackRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=15`,
        {
          headers: {
            Authorization: `Bearer ${gmailAccessToken}`,
          },
        }
      )
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json()
        messages = fallbackData.messages || []
      }
    }

    if (messages.length === 0) {
      console.log("[gmail-fetcher] No emails found in inbox")
      return []
    }

    console.log(`[gmail-fetcher] Found ${messages.length} relevant emails, parsing details...`)

    const emails: EmailParsed[] = []

    for (const message of messages) {
      try {
        const messageResponse = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          {
            headers: {
              Authorization: `Bearer ${gmailAccessToken}`,
            },
          }
        )

        if (!messageResponse.ok) continue

        const messageData = await messageResponse.json()
        const headers = messageData.payload.headers || []

        const subject =
          headers.find((h: any) => h.name === "Subject")?.value || "(No subject)"
        const from =
          headers.find((h: any) => h.name === "From")?.value || "unknown"
        const date =
          headers.find((h: any) => h.name === "Date")?.value || new Date().toISOString()

        const body = extractBodyFromPayload(messageData.payload)

        emails.push({
          from,
          subject,
          body: body.substring(0, 7000), // Up to 7000 chars for full job descriptions
          timestamp: date,
          detectedEvent: "UNKNOWN" as any,
        })
      } catch (err) {
        console.error(`[gmail-fetcher] Error parsing message ${message.id}:`, err)
      }
    }

    console.log(`[gmail-fetcher] Successfully fetched and parsed ${emails.length} emails`)
    return emails
  } catch (error) {
    console.error("[gmail-fetcher] Error fetching emails:", error)
    return []
  }
}
