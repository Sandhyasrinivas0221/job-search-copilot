/**
 * Google OAuth Callback Handler
 *
 * This route handles the callback from Google's OAuth 2.0 authorization server.
 * It exchanges the authorization code for a refresh token and saves it to the database.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state") // Contains userId
    const error = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    // Handle authorization errors from Google
    if (error) {
      console.error("[oauth-callback] Authorization error:", error, errorDescription)
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          errorDescription || error
        )}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          "Missing authorization code"
        )}`
      )
    }

    if (!state) {
      // TEST DATA: For testing without state, use a default test UUID (COMMENTED OUT FOR PRODUCTION)
      // console.warn("[oauth-callback] No state parameter provided, using test UUID for development")
      // return NextResponse.redirect(...)

      // PRODUCTION: Always require state parameter
      console.error("[oauth-callback] OAuth state missing - rejected for security")
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          "Authentication failed: Missing state parameter"
        )}`
      )
    }

    // Decode state to get userId (it's base64 encoded)
    let userId: string
    try {
      userId = Buffer.from(state, "base64").toString("utf-8")
    } catch (e) {
      userId = state // Fallback to raw state if decoding fails
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "",
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error("[oauth-callback] Token exchange failed:", errorData)
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          "Failed to exchange authorization code for tokens"
        )}`
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    if (!access_token || !refresh_token) {
      console.error("[oauth-callback] Missing tokens in response:", tokenData)
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          "No refresh token received from Google"
        )}`
      )
    }

    // Get user's email from Google API
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      console.error("[oauth-callback] Failed to fetch user info")
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          "Failed to fetch user information"
        )}`
      )
    }

    const userInfo = await userInfoResponse.json()
    const email = userInfo.email

    // Calculate token expiry
    const now = new Date()
    const expiryDate = new Date(now.getTime() + (expires_in || 3600) * 1000)

    // Save credentials to database
    const { data: existingCredential, error: fetchError } = await supabaseAdmin
      .from("email_credentials")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .maybeSingle()

    console.log(
      `[oauth-callback] Looking for existing credential for user ${userId}:`,
      existingCredential,
      fetchError
    )

    let saveError: any = null
    let credential: any = null

    if (existingCredential) {
      // Update existing credential
      console.log(`[oauth-callback] Updating existing credential: ${existingCredential.id}`)
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from("email_credentials")
        .update({
          email_address: email,
          gmail_refresh_token: refresh_token,
          gmail_access_token: access_token,
          gmail_token_expiry: expiryDate.toISOString(),
          is_connected: true,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCredential.id)
        .select()
        .single()

      credential = updatedData
      saveError = updateError
      console.log(`[oauth-callback] Update result:`, updatedData, updateError)
    } else {
      // Create new credential
      console.log(`[oauth-callback] Creating new credential for user ${userId}`)
      const { data: newData, error: insertError } = await supabaseAdmin
        .from("email_credentials")
        .insert({
          user_id: userId,
          provider: "gmail",
          email_address: email,
          gmail_refresh_token: refresh_token,
          gmail_access_token: access_token,
          gmail_token_expiry: expiryDate.toISOString(),
          is_connected: true,
          last_verified_at: new Date().toISOString(),
        })
        .select()
        .single()

      credential = newData
      saveError = insertError
      console.log(`[oauth-callback] Insert result:`, newData, insertError)
    }

    if (saveError) {
      console.error("[oauth-callback] Failed to save credentials:", saveError)
      const errorMessage = (saveError as any)?.message || String(saveError)
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
          `Database error: ${errorMessage}`
        )}`
      )
    }

    console.log(
      `[oauth-callback] Successfully saved Gmail credentials for user ${userId}, email: ${email}`
    )

    // Redirect back to settings with success message
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard/settings?tab=email&success=true&email=${encodeURIComponent(
        email
      )}`
    )
  } catch (error) {
    console.error("[oauth-callback] Unexpected error:", error)
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard/settings?tab=email&error=${encodeURIComponent(
        "An unexpected error occurred during authentication"
      )}`
    )
  }
}
