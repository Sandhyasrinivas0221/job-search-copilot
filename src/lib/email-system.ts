/**
 * Email System Utility
 *
 * Handles sending emails via Resend or nodemailer
 * Used by Metrics Reporter Agent for daily job recommendations
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send email using Resend
 *
 * Requires RESEND_API_KEY in environment
 */
export async function sendEmailViaResend(options: EmailOptions): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[email-system] RESEND_API_KEY not configured')
      return false
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: options.from || process.env.SYSTEM_EMAIL_FROM || 'noreply@jobsearchcopilot.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.statusText}`)
    }

    console.log(`[email-system] Email sent to ${options.to}`)
    return true
  } catch (error) {
    console.error('[email-system] Error sending email via Resend:', error)
    return false
  }
}

/**
 * Send email using nodemailer (SMTP)
 *
 * Requires SMTP credentials in environment:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 */
export async function sendEmailViaSMTP(options: EmailOptions): Promise<boolean> {
  try {
    // Import nodemailer dynamically to avoid requiring it when not using SMTP
    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    const result = await transporter.sendMail({
      from: options.from || process.env.SYSTEM_EMAIL_FROM || 'noreply@jobsearchcopilot.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    console.log(`[email-system] Email sent to ${options.to} via SMTP:`, result.messageId)
    return true
  } catch (error) {
    console.error('[email-system] Error sending email via SMTP:', error)
    return false
  }
}

/**
 * Send email with automatic provider selection
 *
 * Tries Resend first (modern SaaS), falls back to SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    return await sendEmailViaResend(options)
  }

  // Fall back to SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return await sendEmailViaSMTP(options)
  }

  console.error('[email-system] No email provider configured (RESEND_API_KEY or SMTP credentials)')
  return false
}

/**
 * Format job suggestions for email HTML
 */
export function formatJobSuggestionsHTML(jobSuggestions: any[], easyApplyCount: number, manualApplyCount: number): string {
  if (jobSuggestions.length === 0) {
    return '<p>No new job suggestions today.</p>'
  }

  const jobCards = jobSuggestions
    .slice(0, 10) // Max 10 jobs per email
    .map((job) => {
      const salaryStr = job.salary_min && job.salary_max ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}` : 'Not specified'
      const matchScoreColor = job.match_score >= 75 ? '#28a745' : job.match_score >= 50 ? '#ffc107' : '#dc3545'

      return `
        <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${matchScoreColor};">
          <h3 style="margin: 0 0 5px 0; font-size: 18px;">
            <strong>${job.job_title}</strong> at <strong>${job.company_name}</strong>
          </h3>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">
            📍 ${job.location || 'Remote'} | 💰 ${salaryStr}
          </p>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">
            Match Score: <span style="color: ${matchScoreColor}; font-weight: bold;">${job.match_score.toFixed(0)}%</span> |
            ${job.easy_apply ? '✨ Easy Apply' : '📝 Manual Apply'}
          </p>
          ${job.description ? `<p style="margin: 10px 0; font-size: 13px; color: #555; line-height: 1.5;">${job.description.substring(0, 150)}...</p>` : ''}
          <a href="${job.job_url}" style="display: inline-block; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; margin-top: 10px;">View Job →</a>
        </div>
      `
    })
    .join('')

  return `
    <h2>New Job Opportunities (${jobSuggestions.length} total)</h2>
    <p style="color: #666; font-size: 14px;">
      📊 ${easyApplyCount} Easy Apply | 📋 ${manualApplyCount} Manual Apply
    </p>
    ${jobCards}
  `
}

/**
 * Format dashboard metrics for email HTML
 */
export function formatMetricsHTML(metrics: any): string {
  return `
    <div style="background: #f0f4f8; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h2>Your Job Search Dashboard</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr style="background: #e8f4f8;">
          <td style="padding: 10px; border: 1px solid #ddd;">Total Applications</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${metrics.totalApplications || 0}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Interview Rate</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #28a745;">${(metrics.interviewRate || 0).toFixed(1)}%</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;">Offer Rate</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #007bff;">${(metrics.offerRate || 0).toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Rejection Rate</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #dc3545;">${(metrics.rejectionRate || 0).toFixed(1)}%</td>
        </tr>
      </table>
    </div>
  `
}

/**
 * Build complete daily email HTML
 */
export function buildDailyEmailHTML(
  metrics: any,
  jobSuggestions: any[],
  easyApplyJobs: any[],
  manualApplyJobs: any[]
): string {
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 0; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 20px; background: white; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    h1 { margin: 0; font-size: 24px; }
    h2 { color: #667eea; size: 18px; margin-top: 25px; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    a { color: #667eea; text-decoration: none; }
    .metric-box { display: inline-block; background: #667eea; color: white; padding: 15px 20px; margin: 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Job Search Copilot</h1>
      <p>${greeting}! Here are your job opportunities for today.</p>
    </div>

    <div class="content">
      ${formatMetricsHTML(metrics)}

      ${formatJobSuggestionsHTML(jobSuggestions, easyApplyJobs.length, manualApplyJobs.length)}

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

      <p style="color: #666; font-size: 13px;">
        <strong>💡 Pro Tip:</strong> Focus on "Easy Apply" jobs first to maximize your application rate.
        The system is tracking your progress and improving suggestions based on your success rate.
      </p>
    </div>

    <div class="footer">
      <p>This email was sent by Job Search Copilot.</p>
      <p><a href="{DASHBOARD_URL}">View your full dashboard</a> | <a href="{SETTINGS_URL}">Update preferences</a></p>
      <p>&copy; ${new Date().getFullYear()} Job Search Copilot. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
}
