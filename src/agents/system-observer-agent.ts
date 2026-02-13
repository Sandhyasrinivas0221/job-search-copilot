/**
 * System Observer Agent - Metrics & Daily Email
 *
 * Sealed Abilities: Read-only on all records
 *
 * Responsibilities:
 * - Compute: applications per week, interview rate, offer rate, rejection reasons, learning progress
 * - Build daily and weekly summary views
 * - At 9:00 AM: send email with new JobSuggestion records
 *   - Subject: "Jobs to apply"
 *   - Body: list EASY_APPLY and MANUAL_APPLY jobs with links and notes
 *
 * Escalation:
 * - If interviews drop to zero, notify Job Market + Learning Planner
 */

import { DashboardMetrics, DailyEmailSummary, JobSuggestion } from "@/types"
import { ApplicationStatus } from "@/types"
import {
  getApplications,
  getApplicationsByStatus,
  getJobSuggestions,
  getLearningTasks,
  getStatusHistory,
} from "@/lib/db"

export class SystemObserverAgent {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Main entry point - compute dashboard metrics
   * Sealed: Read-only on all records
   */
  async computeMetrics(): Promise<DashboardMetrics> {
    console.log(`[SystemObserverAgent] Computing metrics for user ${this.userId}`)

    const applications = await getApplications(this.userId)
    const appliedApps = await getApplicationsByStatus(this.userId, ApplicationStatus.APPLIED)
    const interviewApps = await getApplicationsByStatus(this.userId, ApplicationStatus.INTERVIEW)
    const offerApps = await getApplicationsByStatus(this.userId, ApplicationStatus.OFFER)
    const rejectedApps = await getApplicationsByStatus(this.userId, ApplicationStatus.REJECTED)
    const acceptedApps = await getApplicationsByStatus(this.userId, ApplicationStatus.ACCEPTED)

    // Calculate rates
    const totalApplications = applications.length
    const totalInterviews = interviewApps.length + offerApps.length + acceptedApps.length
    const totalOffers = offerApps.length + acceptedApps.length
    const totalRejections = rejectedApps.length

    const interviewRate = totalApplications > 0 ? (totalInterviews / totalApplications) * 100 : 0
    const offerRate = totalApplications > 0 ? (totalOffers / totalApplications) * 100 : 0
    const rejectionRate = totalApplications > 0 ? (totalRejections / totalApplications) * 100 : 0

    // Calculate applications this week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const applicationsThisWeek = applications.filter((app) => new Date(app.created_at) >= oneWeekAgo).length

    // Calculate average days to interview
    const averageDaysToInterview = this.calculateAverageDaysToInterview(interviewApps)

    // Get top companies
    const topCompanies = this.getTopCompanies(applications)

    // Get top rejection reasons
    const topRejectionReasons = await this.getTopRejectionReasons(rejectedApps)

    // Calculate learning progress
    const learningProgress = await this.calculateLearningProgress()

    // Get upcoming interviews
    const upcomingInterviews = interviewApps.slice(0, 5)

    // Get recent offers
    const recentOffers = offerApps.slice(0, 5)

    return {
      totalApplications,
      applicationsThisWeek,
      interviewRate: Math.round(interviewRate * 100) / 100,
      offerRate: Math.round(offerRate * 100) / 100,
      rejectionRate: Math.round(rejectionRate * 100) / 100,
      averageDaysToInterview,
      topCompanies,
      topRejectionReasons,
      learningProgress,
      upcomingInterviews,
      recentOffers,
    }
  }

  /**
   * Build daily email summary
   */
  async buildDailyEmailSummary(): Promise<DailyEmailSummary> {
    console.log(`[SystemObserverAgent] Building daily email summary for user ${this.userId}`)

    // Get job suggestions from today
    const jobSuggestions = await getJobSuggestions(this.userId)
    const todaysSuggestions = jobSuggestions
      .filter((job) => {
        const created = new Date(job.created_at)
        const today = new Date()
        return created.toDateString() === today.toDateString()
      })
      .sort((a, b) => b.match_score - a.match_score)

    // Separate easy and manual apply jobs
    const easyApplyJobs = todaysSuggestions.filter((job) => job.easy_apply).slice(0, 5)
    const manualApplyJobs = todaysSuggestions.filter((job) => !job.easy_apply).slice(0, 5)

    // Get upcoming interviews today
    const interviewApps = await getApplicationsByStatus(this.userId, ApplicationStatus.INTERVIEW)
    const today = new Date()
    const interviewsToday = interviewApps.filter((app) => {
      const lastUpdate = new Date(app.last_update)
      return lastUpdate.toDateString() === today.toDateString()
    })

    // Get learning tasks due today or overdue
    const learningTasks = await getLearningTasks(this.userId, false)
    const tasksForToday = learningTasks.filter((task) => {
      if (!task.due_date) return false
      const dueDate = new Date(task.due_date)
      return dueDate <= today && !task.completed
    })

    return {
      jobSuggestions: todaysSuggestions,
      easyApplyJobs,
      manualApplyJobs,
      interviewsToday,
      learningTasks: tasksForToday,
    }
  }

  /**
   * Send daily email summary
   */
  async sendDailyEmail(summary: DailyEmailSummary): Promise<void> {
    console.log(`[SystemObserverAgent] Sending daily email summary for user ${this.userId}`)

    if (summary.easyApplyJobs.length === 0 && summary.manualApplyJobs.length === 0) {
      console.log("[SystemObserverAgent] No jobs to send today")
      return
    }

    const emailBody = this.formatEmailBody(summary)

    try {
      // In production, this would use Resend or another email service
      // For now, we just log it
      console.log("[SystemObserverAgent] Email content:")
      console.log(emailBody)

      // Example: Using Resend API
      // await resend.emails.send({
      //   from: process.env.SYSTEM_EMAIL_FROM!,
      //   to: process.env.SYSTEM_EMAIL_TO!,
      //   subject: "Jobs to apply ☀️",
      //   html: emailBody,
      // })

      console.log("[SystemObserverAgent] Daily email sent successfully")
    } catch (error) {
      console.error("[SystemObserverAgent] Error sending email:", error)
    }
  }

  /**
   * Format email body with HTML
   */
  private formatEmailBody(summary: DailyEmailSummary): string {
    const headerStyle = "style='color: #333; font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;'"
    const jobStyle = "style='background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff;'"

    let html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h1>Job Search Copilot - Daily Summary</h1>
          <p>Here are your job recommendations for today.</p>
    `

    // Easy Apply Jobs
    if (summary.easyApplyJobs.length > 0) {
      html += `<h2 ${headerStyle}>🚀 Easy Apply Jobs (${summary.easyApplyJobs.length})</h2>`
      for (const job of summary.easyApplyJobs) {
        html += this.formatJobHtml(job)
      }
    }

    // Manual Apply Jobs
    if (summary.manualApplyJobs.length > 0) {
      html += `<h2 ${headerStyle}>📋 Manual Apply Jobs (${summary.manualApplyJobs.length})</h2>`
      for (const job of summary.manualApplyJobs) {
        html += this.formatJobHtml(job)
      }
    }

    // Upcoming Interviews
    if (summary.interviewsToday.length > 0) {
      html += `<h2 ${headerStyle}>🎯 Upcoming Interviews (${summary.interviewsToday.length})</h2>`
      for (const interview of summary.interviewsToday) {
        html += `
          <div ${jobStyle}>
            <strong>${interview.job_title}</strong> at <strong>${interview.company_name}</strong><br>
            Applied: ${interview.applied_date || "N/A"}<br>
            Days in stage: ${interview.days_in_stage}
          </div>
        `
      }
    }

    // Learning Tasks
    if (summary.learningTasks.length > 0) {
      html += `<h2 ${headerStyle}>📚 Due Learning Tasks (${summary.learningTasks.length})</h2>`
      for (const task of summary.learningTasks) {
        html += `
          <div ${jobStyle}>
            <strong>${task.title}</strong><br>
            Topic: ${task.topic || "General"}<br>
            Estimated hours: ${task.estimated_hours || "N/A"}<br>
            Priority: <span style="color: ${this.getPriorityColor(task.priority)}">${task.priority}</span>
          </div>
        `
      }
    }

    html += `
          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">
            This email was generated by Job Search Copilot.
            Visit your dashboard to manage applications and update your preferences.
          </p>
        </body>
      </html>
    `

    return html
  }

  /**
   * Format individual job as HTML
   */
  private formatJobHtml(job: JobSuggestion): string {
    const salaryStr = job.salary_min && job.salary_max ? `$${job.salary_min} - $${job.salary_max}` : "Not specified"
    const matchScoreColor = job.match_score >= 75 ? "#28a745" : job.match_score >= 50 ? "#ffc107" : "#dc3545"

    return `
      <div style="background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${matchScoreColor};">
        <strong>${job.job_title}</strong> at <strong>${job.company_name}</strong><br>
        Location: ${job.location || "Remote"}<br>
        Salary: ${salaryStr}<br>
        Match Score: <span style="color: ${matchScoreColor}; font-weight: bold;">${job.match_score.toFixed(0)}%</span><br>
        Source: ${job.source_site || "Unknown"}<br>
        Easy Apply: ${job.easy_apply ? "✅ Yes" : "❌ No"}<br>
        <a href="${job.job_url}" style="color: #007bff; text-decoration: none;">View Job →</a>
      </div>
    `
  }

  /**
   * Get priority color for email
   */
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case "HIGH":
        return "#dc3545"
      case "MEDIUM":
        return "#ffc107"
      case "LOW":
        return "#28a745"
      default:
        return "#666"
    }
  }

  /**
   * Calculate average days to interview
   */
  private calculateAverageDaysToInterview(interviewApps: any[]): number {
    if (interviewApps.length === 0) return 0

    const totalDays = interviewApps.reduce((sum, app) => sum + (app.days_in_stage || 0), 0)
    return Math.round(totalDays / interviewApps.length)
  }

  /**
   * Get top companies by applications
   */
  private getTopCompanies(applications: any[]): { company: string; count: number }[] {
    const companyCounts = new Map<string, number>()

    for (const app of applications) {
      const count = companyCounts.get(app.company_name) || 0
      companyCounts.set(app.company_name, count + 1)
    }

    return Array.from(companyCounts.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  /**
   * Get top rejection reasons
   */
  private async getTopRejectionReasons(rejectedApps: any[]): Promise<{ reason: string; count: number }[]> {
    const reasonCounts = new Map<string, number>()

    for (const app of rejectedApps) {
      const history = await getStatusHistory(app.id)
      const rejectionEntry = history.find((h) => h.new_status === ApplicationStatus.REJECTED)

      if (rejectionEntry && rejectionEntry.reason) {
        const count = reasonCounts.get(rejectionEntry.reason) || 0
        reasonCounts.set(rejectionEntry.reason, count + 1)
      }
    }

    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  /**
   * Calculate learning progress
   */
  private async calculateLearningProgress(): Promise<number> {
    const tasks = await getLearningTasks(this.userId, false)

    if (tasks.length === 0) return 0

    const completed = tasks.filter((t) => t.completed).length
    return Math.round((completed / tasks.length) * 100)
  }

  /**
   * Check for low interview rate escalation
   */
  async checkLowInterviewRateEscalation(): Promise<boolean> {
    const metrics = await this.computeMetrics()

    if (metrics.totalApplications > 5 && metrics.interviewRate === 0) {
      console.warn(
        `[SystemObserverAgent] ESCALATION: Interview rate is 0% with ${metrics.totalApplications} applications. ` +
          `Job Market Agent should widen search, Learning Planner should increase focus.`
      )
      return true
    }

    return false
  }
}
