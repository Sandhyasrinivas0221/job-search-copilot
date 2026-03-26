/**
 * Gmail Email Fetcher
 * Fetches emails from Gmail using OAuth credentials
 */

import { EmailParsed } from "@/types"

export async function fetchGmailEmails(
  gmailAccessToken: string,
  limit: number = 10
): Promise<EmailParsed[]> {
  try {
    console.log("[gmail-fetcher] Fetching emails from Gmail...")

    // Get list of messages
    const listResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=is:unread`,
      {
        headers: {
          Authorization: `Bearer ${gmailAccessToken}`,
        },
      }
    )

    if (!listResponse.ok) {
      console.error("[gmail-fetcher] Failed to fetch message list:", listResponse.statusText)
      return []
    }

    const listData = await listResponse.json()
    const messages = listData.messages || []

    if (messages.length === 0) {
      console.log("[gmail-fetcher] No unread emails found")
      return []
    }

    console.log(`[gmail-fetcher] Found ${messages.length} unread emails, fetching details...`)

    // Fetch each message
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

        if (!messageResponse.ok) {
          console.warn(`[gmail-fetcher] Failed to fetch message ${message.id}`)
          continue
        }

        const messageData = await messageResponse.json()
        const headers = messageData.payload.headers || []

        // Extract header info
        const subject =
          headers.find((h: any) => h.name === "Subject")?.value || "(No subject)"
        const from = headers.find((h: any) => h.name === "From")?.value || "unknown"
        const date = headers.find((h: any) => h.name === "Date")?.value || new Date().toISOString()

        // Extract body
        let body = ""
        if (messageData.payload.parts) {
          // Multipart message
          const textPart = messageData.payload.parts.find(
            (p: any) => p.mimeType === "text/plain"
          )
          if (textPart && textPart.body.data) {
            body = Buffer.from(textPart.body.data, "base64").toString("utf-8")
          }
        } else if (messageData.payload.body.data) {
          // Simple message
          body = Buffer.from(messageData.payload.body.data, "base64").toString("utf-8")
        }

        emails.push({
          from,
          subject,
          body: body.substring(0, 5000), // Limit to 5000 chars
          timestamp: date,
          detectedEvent: "UNKNOWN" as any, // Will be detected by Mail Agent
        })
      } catch (error) {
        console.error(`[gmail-fetcher] Error processing message ${message.id}:`, error)
      }
    }

    console.log(`[gmail-fetcher] Successfully fetched ${emails.length} emails`)
    return emails
  } catch (error) {
    console.error("[gmail-fetcher] Error fetching emails:", error)
    return []
  }
}
