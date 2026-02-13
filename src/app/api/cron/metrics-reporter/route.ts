/**
 * Vercel Cron: Metrics Reporter Agent (Daily Email)
 *
 * Route: /api/cron/metrics-reporter
 * Schedule: Daily at 9:00 AM (0 9 * * *)
 *
 * This agent sends the daily "Jobs to Apply" email with:
 * - New job suggestions
 * - Easy apply opportunities
 * - Dashboard metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail, buildDailyEmailHTML } from '@/lib/email-system'
import { logAgentAction } from '@/lib/agent-logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[cron/metrics-reporter] Starting metrics reporter agent (daily email)')

    // Get all active users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .limit(100)

    if (usersError || !users) {
      throw new Error(`Failed to fetch users: ${usersError?.message}`)
    }

    let emailsSent = 0
    let emailsFailed = 0

    // Send email to each user
    for (const user of users) {
      try {
        // Compute metrics
        const { data: applications } = await supabaseAdmin
          .from('applications')
          .select('*')
          .eq('user_id', user.id)

        const totalApplications = applications?.length || 0
        const interviews = applications?.filter((a) => a.current_status === 'INTERVIEW').length || 0
        const offers = applications?.filter((a) => a.current_status === 'OFFER').length || 0
        const rejections = applications?.filter((a) => a.current_status === 'REJECTED').length || 0

        const metrics = {
          totalApplications,
          interviewRate: totalApplications > 0 ? (interviews / totalApplications) * 100 : 0,
          offerRate: totalApplications > 0 ? (offers / totalApplications) * 100 : 0,
          rejectionRate: totalApplications > 0 ? (rejections / totalApplications) * 100 : 0,
        }

        // Get job suggestions for today
        const today = new Date().toISOString().split('T')[0]
        const { data: jobSuggestions } = await supabaseAdmin
          .from('job_suggestions')
          .select('*')
          .eq('user_id', user.id)
          .eq('applied', false)
          .eq('dismissed', false)
          .order('match_score', { ascending: false })
          .limit(20)

        const easyApply = jobSuggestions?.filter((j) => j.easy_apply) || []
        const manualApply = jobSuggestions?.filter((j) => !j.easy_apply) || []

        // Skip if no jobs to suggest
        if ((jobSuggestions?.length || 0) === 0) {
          console.log(`[cron/metrics-reporter] No jobs for user ${user.id}, skipping email`)
          continue
        }

        // Build and send email
        const html = buildDailyEmailHTML(metrics, jobSuggestions || [], easyApply, manualApply)
        const sent = await sendEmail({
          to: user.email,
          subject: `🎯 Daily Job Opportunities (${(jobSuggestions?.length || 0)} new jobs)`,
          html,
        })

        if (sent) {
          emailsSent++

          // Log email sent
          await supabaseAdmin.from('email_logs').insert([
            {
              user_id: user.id,
              email_to: user.email,
              subject: `Daily Job Opportunities (${jobSuggestions?.length || 0} new jobs)`,
              status: 'SENT',
            },
          ])
        } else {
          emailsFailed++
        }
      } catch (userError) {
        console.error(`[cron/metrics-reporter] Error processing user ${user.id}:`, userError)
        emailsFailed++
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Metrics reporter agent executed',
      emailsSent,
      emailsFailed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/metrics-reporter] Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
