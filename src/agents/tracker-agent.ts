/**
 * Tracker Agent - Pipeline Manager
 *
 * Sealed Abilities: Cannot read raw emails, cannot create applications
 *
 * Responsibilities:
 * - Derive current status from StatusHistory events
 * - Auto-archive early rejections (screening stage)
 * - Mark "no response" if no changes > X days
 * - Maintain lastUpdate, daysInStage fields
 *
 * Escalation:
 * - If APPLIED > N days with no update → FOLLOW_UP_SUGGESTED
 */

import { ApplicationStatus, TrackerMetrics, Application } from "@/types"
import { getApplications, updateApplication, createStatusHistory } from "@/lib/db"

const NO_RESPONSE_THRESHOLD_DAYS = 14 // Mark as NO_RESPONSE if no update for 14 days
const FOLLOW_UP_SUGGESTION_DAYS = 7 // Suggest follow-up if APPLIED for 7 days without progress

export class TrackerAgent {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Main entry point - runs pipeline management pipeline
   * Sealed: Cannot read raw emails, cannot create applications
   */
  async managePipeline(): Promise<TrackerMetrics> {
    console.log(`[TrackerAgent] Managing pipeline for user ${this.userId}`)

    const applications = await getApplications(this.userId)
    const metrics = this.calculateMetrics(applications)

    // Process all applications
    for (const app of applications) {
      try {
        await this.processApplication(app)
      } catch (error) {
        console.error(`[TrackerAgent] Error processing application ${app.id}:`, error)
      }
    }

    return metrics
  }

  /**
   * Process a single application for status updates
   */
  private async processApplication(application: Application): Promise<void> {
    // Calculate days since last update
    const lastUpdate = new Date(application.last_update)
    const now = new Date()
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))

    // Update days_in_stage
    const appliedDate = application.applied_date ? new Date(application.applied_date) : new Date(application.created_at)
    const daysInStage = Math.floor((now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24))

    await updateApplication(application.id, {
      days_in_stage: daysInStage,
    })

    // Check for escalations and auto-updates
    if (application.current_status === ApplicationStatus.APPLIED) {
      // Handle follow-up suggestions
      if (daysInStage >= FOLLOW_UP_SUGGESTION_DAYS) {
        await updateApplication(application.id, {
          current_status: ApplicationStatus.FOLLOW_UP_SUGGESTED,
        })

        await createStatusHistory({
          application_id: application.id,
          user_id: this.userId,
          old_status: ApplicationStatus.APPLIED,
          new_status: ApplicationStatus.FOLLOW_UP_SUGGESTED,
          reason: `No response after ${daysInStage} days`,
          detected_by: "TrackerAgent",
        })

        console.log(`[TrackerAgent] Marked ${application.company_name} as FOLLOW_UP_SUGGESTED`)
      }
    }

    // Check for no response
    if (daysSinceUpdate >= NO_RESPONSE_THRESHOLD_DAYS && application.current_status !== ApplicationStatus.ARCHIVED) {
      // Check if status is APPLIED or FOLLOW_UP_SUGGESTED
      if (
        application.current_status === ApplicationStatus.APPLIED ||
        application.current_status === ApplicationStatus.FOLLOW_UP_SUGGESTED
      ) {
        await updateApplication(application.id, {
          current_status: ApplicationStatus.NO_RESPONSE,
        })

        await createStatusHistory({
          application_id: application.id,
          user_id: this.userId,
          old_status: application.current_status,
          new_status: ApplicationStatus.NO_RESPONSE,
          reason: `No response for ${daysSinceUpdate} days`,
          detected_by: "TrackerAgent",
        })

        console.log(`[TrackerAgent] Marked ${application.company_name} as NO_RESPONSE`)
      }
    }

    // Auto-archive early rejections
    if (application.current_status === ApplicationStatus.REJECTED) {
      // Check if rejection was during screening
      const appliedDates = new Date(application.created_at)
      const rejectionDate = new Date(application.last_update)
      const daysBetween = Math.floor((rejectionDate.getTime() - appliedDates.getTime()) / (1000 * 60 * 60 * 24))

      if (daysBetween <= 3) {
        // Early rejection (within 3 days)
        await updateApplication(application.id, {
          current_status: ApplicationStatus.ARCHIVED,
        })

        console.log(`[TrackerAgent] Auto-archived early rejection for ${application.company_name}`)
      }
    }
  }

  /**
   * Calculate pipeline metrics
   */
  private calculateMetrics(applications: Application[]): TrackerMetrics {
    const applicationsByStage: Record<ApplicationStatus, number> = {
      [ApplicationStatus.APPLIED]: 0,
      [ApplicationStatus.SCREENING]: 0,
      [ApplicationStatus.INTERVIEW]: 0,
      [ApplicationStatus.OFFER]: 0,
      [ApplicationStatus.REJECTED]: 0,
      [ApplicationStatus.ACCEPTED]: 0,
      [ApplicationStatus.ARCHIVED]: 0,
      [ApplicationStatus.NEEDS_REVIEW]: 0,
      [ApplicationStatus.FOLLOW_UP_SUGGESTED]: 0,
      [ApplicationStatus.NO_RESPONSE]: 0,
    }

    const applicationsWithoutUpdate: Application[] = []
    const needsFollowUp: Application[] = []
    const earlyRejections: Application[] = []

    for (const app of applications) {
      applicationsByStage[app.current_status]++

      const lastUpdate = new Date(app.last_update)
      const now = new Date()
      const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceUpdate >= NO_RESPONSE_THRESHOLD_DAYS) {
        applicationsWithoutUpdate.push(app)
      }

      if (app.current_status === ApplicationStatus.FOLLOW_UP_SUGGESTED) {
        needsFollowUp.push(app)
      }

      if (app.current_status === ApplicationStatus.REJECTED && app.days_in_stage <= 3) {
        earlyRejections.push(app)
      }
    }

    return {
      applicationsByStage,
      applicationsWithoutUpdate,
      needsFollowUp,
      earlyRejections,
    }
  }
}
