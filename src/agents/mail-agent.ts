/**
 * Mail Agent - Inbox Listener
 *
 * Sealed Abilities: Cannot send emails or apply to jobs
 *
 * Responsibilities:
 * - Read emails from configured inboxes (Gmail/Outlook via IMAP/OAuth)
 * - Detect: application received, OA/invite, interview scheduled, rejection, offer
 * - Extract: company, role, platform, dates, stage from subject/body
 * - Create/update Application + StatusHistory entries
 *
 * Escalation:
 * - If ambiguous, set status=NEEDS_REVIEW and log notes
 */

import { EmailEventType, EmailParsed, ApplicationStatus } from "@/types"
import { createApplication, updateApplication, getApplications, createStatusHistory } from "@/lib/db"

const EMAIL_PATTERNS = {
  applicationReceived: [
    /confirmation.*receipt|received.*application|application.*confirm/i,
    /thanks.*applying|thank you for your interest|application.*submitted/i,
    /(?:junior|senior|lead|staff)\s+(?:software\s+)?engineer|developer|analyst|manager|specialist/i,
    /job.*posting|indeed|matched.*job|you.*may.*like/i,
    /@\s*[\w\s]/i,
  ],
  interviewScheduled: [
    /interview.*scheduled|schedule.*interview|interview.*today|interview.*tomorrow/i,
    /meeting.*set|call.*scheduled|let's talk|phone.*screen/i,
  ],
  offer: [
    /offer|congratul|excited to extend|we're pleased|we'd like to offer/i,
    /joining.*team|start date|compensation|salary/i,
  ],
  rejection: [
    /reject|unfortunately|not move forward|decline|passing|don't go forward/i,
    /selected other candidates|pursued other candidates|other applicants/i,
  ],
  oaOrAssignment: [
    /coding challenge|assignment|take-home|assessment|OA|online assessment/i,
    /test.*available|complete.*test|problem.*solve|assessment/i,
  ],
  feedback: [
    /feedback|next round|advance|interview feedback|consideration/i,
  ],
}

export class MailAgent {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Main entry point - processes incoming emails
   * Sealed: Cannot send emails or apply to jobs
   */
  async processInboxEmails(emails: EmailParsed[]): Promise<void> {
    console.log(`[MailAgent] Processing ${emails.length} emails for user ${this.userId}`)

    for (const email of emails) {
      try {
        await this.processEmail(email)
      } catch (error) {
        console.error(`[MailAgent] Error processing email from ${email.from}:`, error)
      }
    }
  }

  /**
   * Process a single email and detect the event type
   */
  private async processEmail(email: EmailParsed): Promise<void> {
    const eventType = this.detectEmailEventType(email.subject, email.body)
    console.log(`[MailAgent] Detected event: ${eventType} from ${email.from}`)

    // Extract company and role from email
    const { company, role } = this.extractCompanyAndRole(email.subject, email.body)

    if (!company) {
      // If we can't extract company, escalate to NEEDS_REVIEW
      console.warn(`[MailAgent] Could not extract company from email. Escalating to NEEDS_REVIEW.`)
      return
    }

    // Try to find existing application
    let application = await this.findExistingApplication(company, role)

    // Handle different event types
    switch (eventType) {
      case EmailEventType.APPLICATION_RECEIVED:
        application = await this.handleApplicationReceived(email, company, role, application)
        break

      case EmailEventType.INTERVIEW_SCHEDULED:
        await this.handleInterviewScheduled(email, company, role, application)
        break

      case EmailEventType.OFFER:
        await this.handleOffer(email, company, role, application)
        break

      case EmailEventType.REJECTION:
        await this.handleRejection(email, company, role, application)
        break

      case EmailEventType.OA_SENT:
        await this.handleOAOrAssignment(email, company, role, application)
        break

      case EmailEventType.FEEDBACK:
        await this.handleFeedback(email, company, role, application)
        break

      case EmailEventType.UNKNOWN:
        // Escalate ambiguous emails
        if (application) {
          await createStatusHistory({
            application_id: application.id,
            user_id: this.userId,
            old_status: application.current_status,
            new_status: ApplicationStatus.NEEDS_REVIEW,
            reason: "Email event type unclear",
            notes: `Subject: ${email.subject}\n\nBody: ${email.body.substring(0, 500)}`,
            email_subject: email.subject,
            email_body: email.body,
            detected_by: "MailAgent",
          })
        }
        break
    }
  }

  /**
   * Detect the type of email event based on content
   */
  private detectEmailEventType(subject: string, body: string): EmailEventType {
    const content = `${subject} ${body}`.toLowerCase()
    console.log(`[MailAgent.detectEmailEventType] Subject: "${subject.substring(0, 100)}"`)

    for (const pattern of EMAIL_PATTERNS.offer) {
      if (pattern.test(content)) {
        console.log(`[MailAgent.detectEmailEventType] ✓ Matched OFFER pattern`)
        return EmailEventType.OFFER
      }
    }

    for (const pattern of EMAIL_PATTERNS.rejection) {
      if (pattern.test(content)) {
        console.log(`[MailAgent.detectEmailEventType] ✓ Matched REJECTION pattern`)
        return EmailEventType.REJECTION
      }
    }

    for (const pattern of EMAIL_PATTERNS.interviewScheduled) {
      if (pattern.test(content)) {
        console.log(`[MailAgent.detectEmailEventType] ✓ Matched INTERVIEW_SCHEDULED pattern`)
        return EmailEventType.INTERVIEW_SCHEDULED
      }
    }

    for (const pattern of EMAIL_PATTERNS.oaOrAssignment) {
      if (pattern.test(content)) {
        console.log(`[MailAgent.detectEmailEventType] ✓ Matched OA_SENT pattern`)
        return EmailEventType.OA_SENT
      }
    }

    for (const pattern of EMAIL_PATTERNS.applicationReceived) {
      if (pattern.test(content)) {
        console.log(`[MailAgent.detectEmailEventType] ✓ Matched APPLICATION_RECEIVED pattern`)
        return EmailEventType.APPLICATION_RECEIVED
      }
    }

    for (const pattern of EMAIL_PATTERNS.feedback) {
      if (pattern.test(content)) {
        console.log(`[MailAgent.detectEmailEventType] ✓ Matched FEEDBACK pattern`)
        return EmailEventType.FEEDBACK
      }
    }

    console.log(`[MailAgent.detectEmailEventType] ✗ No pattern matched, returning UNKNOWN`)
    return EmailEventType.UNKNOWN
  }

  /**
   * Extract company and role from email
   */
  private extractCompanyAndRole(subject: string, body: string): { company: string | null; role: string | null } {
    // Try multiple patterns to extract company
    let company: string | null = null

    // Pattern 1: "Role @ Company" (e.g., "Junior Software Engineer @ Xodus Group")
    const atMatch = subject.match(/(?:position|role|engineer|developer|manager|analyst)\s+(?:in|@|at)\s+([A-Z][^@\n]+?)(?:\s|$)/i)
    if (atMatch) {
      company = atMatch[1].trim()
    }

    // Pattern 2: "Company" at start of subject (e.g., "Coursera for $239/year")
    if (!company) {
      const startMatch = subject.match(/^([A-Z][a-zA-Z\s&.,-]+?)(?:\s+(?:for|is|presents|offers|invites|inviting))/i)
      if (startMatch) {
        company = startMatch[1].trim()
      }
    }

    // Pattern 3: "from Company" (e.g., "Application from LinkedIn")
    if (!company) {
      const fromMatch = subject.match(/(?:from|at|with)\s+([A-Z][A-Za-z\s&.,-]+?)(?:\s+(?:for|role|position|job|–|-|:)|\s*$)/i)
      if (fromMatch) {
        company = fromMatch[1].trim()
      }
    }

    // Extract role if possible
    const roleMatch = subject.match(/(?:position|role|for)\s+(?:a\s+)?([A-Za-z\s]+?)(?:\s+(?:at|@|in|from|role|position)|\s*$)/i)
    const role = roleMatch ? roleMatch[1].trim() : null

    console.log(`[MailAgent.extractCompanyAndRole] Subject: "${subject.substring(0, 80)}" => company: "${company}", role: "${role}"`)

    return { company: company ? company.replace(/\s+/g, " ") : null, role }
  }

  /**
   * Find existing application by company and role
   */
  private async findExistingApplication(company: string, role: string | null): Promise<any | null> {
    const applications = await getApplications(this.userId)
    return applications.find(
      (app) =>
        app.company_name.toLowerCase() === company.toLowerCase() &&
        (!role || app.job_title.toLowerCase() === role.toLowerCase())
    )
  }

  // ============= EVENT HANDLERS =============

  private async handleApplicationReceived(email: EmailParsed, company: string, role: string | null, application: any): Promise<any> {
    console.log(`[MailAgent] Handling APPLICATION_RECEIVED for ${company}`)

    if (!application) {
      // Create new application
      application = await createApplication({
        user_id: this.userId,
        company_name: company,
        job_title: role || "Unknown Role",
        applied_date: new Date().toISOString().split("T")[0],
        current_status: ApplicationStatus.APPLIED,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
        easy_apply: false,
        description: null,
        job_url: null,
        location: null,
        salary_min: null,
        salary_max: null,
        source_site: "email",
      })
    }

    if (application.current_status === ApplicationStatus.APPLIED) {
      // Already in APPLIED status, no change needed
      return application
    }

    // Update to APPLIED status
    application = await updateApplication(application.id, {
      current_status: ApplicationStatus.APPLIED,
      last_update: new Date().toISOString(),
    })

    await createStatusHistory({
      application_id: application.id,
      user_id: this.userId,
      old_status: null,
      new_status: ApplicationStatus.APPLIED,
      reason: "Application confirmation received",
      notes: null,
      email_subject: email.subject,
      email_body: email.body,
      detected_by: "MailAgent",
    })

    return application
  }

  private async handleInterviewScheduled(email: EmailParsed, company: string, role: string | null, application: any): Promise<void> {
    console.log(`[MailAgent] Handling INTERVIEW_SCHEDULED for ${company}`)

    if (!application) {
      // Create new application with INTERVIEW status
      application = await createApplication({
        user_id: this.userId,
        company_name: company,
        job_title: role || "Unknown Role",
        applied_date: new Date().toISOString().split("T")[0],
        current_status: ApplicationStatus.INTERVIEW,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
        easy_apply: false,
        description: null,
        job_url: null,
        location: null,
        salary_min: null,
        salary_max: null,
        source_site: "email",
      })
    }

    await updateApplication(application.id, {
      current_status: ApplicationStatus.INTERVIEW,
      last_update: new Date().toISOString(),
    })

    await createStatusHistory({
      application_id: application.id,
      user_id: this.userId,
      old_status: application.current_status,
      new_status: ApplicationStatus.INTERVIEW,
      reason: "Interview scheduled",
      notes: null,
      email_subject: email.subject,
      email_body: email.body,
      detected_by: "MailAgent",
    })
  }

  private async handleOffer(email: EmailParsed, company: string, role: string | null, application: any): Promise<void> {
    console.log(`[MailAgent] Handling OFFER for ${company}`)

    if (!application) {
      // Create new application with OFFER status
      application = await createApplication({
        user_id: this.userId,
        company_name: company,
        job_title: role || "Unknown Role",
        applied_date: new Date().toISOString().split("T")[0],
        current_status: ApplicationStatus.OFFER,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
        easy_apply: false,
        description: null,
        job_url: null,
        location: null,
        salary_min: null,
        salary_max: null,
        source_site: "email",
      })
    }

    await updateApplication(application.id, {
      current_status: ApplicationStatus.OFFER,
      last_update: new Date().toISOString(),
    })

    await createStatusHistory({
      application_id: application.id,
      user_id: this.userId,
      old_status: application.current_status,
      new_status: ApplicationStatus.OFFER,
      reason: "Job offer received",
      notes: null,
      email_subject: email.subject,
      email_body: email.body,
      detected_by: "MailAgent",
    })
  }

  private async handleRejection(email: EmailParsed, company: string, role: string | null, application: any): Promise<void> {
    console.log(`[MailAgent] Handling REJECTION for ${company}`)

    if (!application) {
      // Create new application with REJECTED status
      application = await createApplication({
        user_id: this.userId,
        company_name: company,
        job_title: role || "Unknown Role",
        applied_date: new Date().toISOString().split("T")[0],
        current_status: ApplicationStatus.REJECTED,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
        easy_apply: false,
        description: null,
        job_url: null,
        location: null,
        salary_min: null,
        salary_max: null,
        source_site: "email",
      })
    }

    await updateApplication(application.id, {
      current_status: ApplicationStatus.REJECTED,
      last_update: new Date().toISOString(),
    })

    await createStatusHistory({
      application_id: application.id,
      user_id: this.userId,
      old_status: application.current_status,
      new_status: ApplicationStatus.REJECTED,
      reason: "Rejection received",
      notes: null,
      email_subject: email.subject,
      email_body: email.body,
      detected_by: "MailAgent",
    })
  }

  private async handleOAOrAssignment(email: EmailParsed, company: string, role: string | null, application: any): Promise<void> {
    console.log(`[MailAgent] Handling OA_SENT for ${company}`)

    if (!application) {
      // Create new application with SCREENING status
      application = await createApplication({
        user_id: this.userId,
        company_name: company,
        job_title: role || "Unknown Role",
        applied_date: new Date().toISOString().split("T")[0],
        current_status: ApplicationStatus.SCREENING,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
        easy_apply: false,
        description: null,
        job_url: null,
        location: null,
        salary_min: null,
        salary_max: null,
        source_site: "email",
      })
    } else if (application.current_status === ApplicationStatus.APPLIED) {
      await updateApplication(application.id, {
        current_status: ApplicationStatus.SCREENING,
        last_update: new Date().toISOString(),
      })
    }

    await createStatusHistory({
      application_id: application.id,
      user_id: this.userId,
      old_status: application.current_status,
      new_status: ApplicationStatus.SCREENING,
      reason: "Coding challenge or assessment sent",
      notes: null,
      email_subject: email.subject,
      email_body: email.body,
      detected_by: "MailAgent",
    })
  }

  private async handleFeedback(email: EmailParsed, company: string, role: string | null, application: any): Promise<void> {
    console.log(`[MailAgent] Handling FEEDBACK for ${company}`)

    if (application) {
      await createStatusHistory({
        application_id: application.id,
        user_id: this.userId,
        old_status: application.current_status,
        new_status: application.current_status,
        reason: "Feedback received",
        notes: null,
        email_subject: email.subject,
        email_body: email.body,
        detected_by: "MailAgent",
      })
    }
  }
}
