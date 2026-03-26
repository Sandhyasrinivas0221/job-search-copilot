import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { EmailCredentials, GmailConfig, SmtpConfig } from "@/types"

/**
 * GET /api/email/credentials
 * Fetch user's email credentials
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      )
    }

    const { data: credentials, error } = await supabaseAdmin
      .from("email_credentials")
      .select("*")
      .eq("user_id", userId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      credentials: credentials || [],
    })
  } catch (error) {
    console.error("Email credentials fetch error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/credentials
 * Save email credentials (Gmail OAuth or SMTP)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, provider, email_address, gmail_config, smtp_config } = body

    if (!userId || !provider || !email_address) {
      return NextResponse.json(
        { error: "Missing required fields: userId, provider, email_address" },
        { status: 400 }
      )
    }

    if (!["gmail", "smtp"].includes(provider)) {
      return NextResponse.json(
        { error: "Provider must be 'gmail' or 'smtp'" },
        { status: 400 }
      )
    }

    const credentialData: any = {
      user_id: userId,
      provider,
      email_address,
      is_connected: true,
      last_verified_at: new Date().toISOString(),
    }

    if (provider === "gmail" && gmail_config) {
      credentialData.gmail_refresh_token = gmail_config.refresh_token
      credentialData.gmail_access_token = gmail_config.access_token
      credentialData.gmail_token_expiry = gmail_config.token_expiry
    }

    if (provider === "smtp" && smtp_config) {
      credentialData.smtp_host = smtp_config.host
      credentialData.smtp_port = smtp_config.port
      credentialData.smtp_username = smtp_config.username
      credentialData.smtp_password = smtp_config.password
      credentialData.smtp_use_tls = smtp_config.use_tls
    }

    // Upsert (update if exists, insert if not)
    const { data, error } = await supabaseAdmin
      .from("email_credentials")
      .upsert(credentialData, { onConflict: "user_id,provider" })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      credentials: data,
      message: `${provider === "gmail" ? "Gmail" : "SMTP"} email configuration saved successfully`,
    })
  } catch (error) {
    console.error("Email credentials save error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email/credentials
 * Delete email credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    const provider = request.nextUrl.searchParams.get("provider")

    if (!userId || !provider) {
      return NextResponse.json(
        { error: "Missing userId or provider" },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from("email_credentials")
      .delete()
      .eq("user_id", userId)
      .eq("provider", provider)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Email credentials deleted successfully",
    })
  } catch (error) {
    console.error("Email credentials delete error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
