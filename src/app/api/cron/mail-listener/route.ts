/**
 * Vercel Cron: Mail Listener Agent
 *
 * Route: /api/cron/mail-listener
 * Schedule: Every 5 minutes (*/5 * * * *)
 *
 * Triggered automatically by Vercel at the specified schedule
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Vercel automatically calls this when the cron schedule is triggered
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel (optional but recommended)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[cron/mail-listener] Starting mail listener agent')

    // In production, fetch real emails from Gmail/Outlook API
    // For now, we'll just log the execution
    // await runMailListenerAgent(userId, emails)

    return NextResponse.json({
      ok: true,
      message: 'Mail listener agent executed',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/mail-listener] Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
