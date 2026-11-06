/**
 * Mail Agent - Universal Inbox Listener
 *
 * Sealed Abilities: Cannot send emails or apply to jobs without user action
 *
 * Responsibilities:
 * - Read job application emails from connected inboxes (Gmail/Outlook)
 * - Universally detect and extract applications across any field (Care Work, Healthcare, Education, Tech, Logistics, etc.)
 * - Parse Indeed, Reed, LinkedIn, Totaljobs, NHS, and direct employer updates
 * - Create and update Application records and StatusHistory
 */

import { EmailEventType, EmailParsed, ApplicationStatus, Application } from "@/types"
import { createApplication, updateApplication, getApplications, createStatusHistory, getUser } from "@/lib/db"

export class MailAgent {
  private userId: string
  private targetRole: string | null = null
  private industryField: string | null = null
  private searchKeywords: string[] = []

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Load candidate's career context from their profile/resume
   */
  async loadUserContext(): Promise<void> {
    try {
      const user = await getUser(this.userId)
      if (user?.bio) {
        try {
          const parsed = JSON.parse(user.bio)
          this.targetRole = parsed.target_role || null
          this.industryField = parsed.industry_field || null
          this.searchKeywords = Array.isArray(parsed.search_keywords) ? parsed.search_keywords : []
        } catch {
          // unparsed text bio
        }
      }
    } catch (err) {
      console.warn(`[MailAgent] Could not load user context for ${this.userId}:`, err)
    }
  }

  /**
   * Main entry point - processes incoming emails
   */
  async processInboxEmails(emails: EmailParsed[]): Promise<Application[]> {
    console.log(`[MailAgent] Processing ${emails.length} emails for user ${this.userId}`)
    await this.loadUserContext()
    const processedApplications: Application[] = []

    for (const email of emails) {
      try {
        const app = await this.processEmail(email)
        if (app) {
          processedApplications.push(app)
        }
      } catch (error) {
        console.error(`[MailAgent] Error processing email from ${email.from}:`, error)
      }
    }

    return processedApplications
  }

  /**
   * Process a single email and detect the event type & application data
   */
  private async processEmail(email: EmailParsed): Promise<Application | null> {
    const { subject, body, from, timestamp } = email
    const eventType = this.detectEmailEventType(subject, body, from)

    if (eventType === EmailEventType.UNKNOWN) {
      return null
    }

    console.log(`[MailAgent] Detected event: ${eventType} from ${from} | "${subject}"`)

    // Extract company, role, location from subject and body
    const extracted = this.extractDetails(subject, body, from)

    if (!extracted.company && !extracted.role) {
      console.warn(`[MailAgent] Could not extract company or role from: "${subject}"`)
      return null
    }

    const company = extracted.company || "Direct Employer"
    const role = extracted.role || this.targetRole || "Job Applicant"
    const location = extracted.location || null

    // Look for existing application in user's pipeline
    const existing = await this.findExistingApplication(company, role)

    switch (eventType) {
      case EmailEventType.APPLICATION_RECEIVED:
        return await this.handleApplicationReceived(email, company, role, location, existing)

      case EmailEventType.INTERVIEW_SCHEDULED:
        return await this.handleStatusTransition(
          existing,
          company,
          role,
          ApplicationStatus.INTERVIEW,
          "Interview invitation or message received",
          email
        )

      case EmailEventType.OFFER:
        return await this.handleStatusTransition(
          existing,
          company,
          role,
          ApplicationStatus.OFFER,
          "Job offer received",
          email
        )

      case EmailEventType.REJECTION:
        return await this.handleStatusTransition(
          existing,
          company,
          role,
          ApplicationStatus.REJECTED,
          "Application rejected or role closed",
          email
        )

      case EmailEventType.OA_SENT:
        return await this.handleStatusTransition(
          existing,
          company,
          role,
          ApplicationStatus.SCREENING,
          "Assessment or screening questionnaire requested",
          email
        )

      case EmailEventType.FEEDBACK:
        return await this.handleStatusTransition(
          existing,
          company,
          role,
          ApplicationStatus.NEEDS_REVIEW,
          "Employer feedback or message update",
          email
        )

      default:
        return null
    }
  }

  /**
   * Identifies and blocks job alerts, newsletters, and marketing digests from being logged as applications
   */
  private isJobAlert(subject: string, body: string, from: string): boolean {
    const s = subject.toLowerCase()
    const b = body.toLowerCase()
    const f = from.toLowerCase()

    if (
      /job alert|jobs alert|job alerts|new jobs in|jobs for you|recommended for you|jobs you might like|jobs you may like|similar jobs|job recommendations|urgent hiring in|daily job alert|weekly job alert|saved search|job suggestions|matches for your search|hiring now:/i.test(
        s
      )
    ) {
      return true
    }

    if (
      /alert|jobalerts|job-alert|newsletter|recommendations|mailer|digest/i.test(f)
    ) {
      return true
    }

    if (
      /you are receiving this job alert|view more jobs|manage this job alert|create another alert|save this job alert|unsubscribe from job alerts|jobs similar to your search|jobs matching your search/i.test(
        b
      )
    ) {
      return true
    }

    return false
  }

  /**
   * Detects the email category across all industries and platforms
   */
  private detectEmailEventType(subject: string, body: string, from: string): EmailEventType {
    // 0. Strict Job Alert blocker - NEVER classify a job alert / digest as an application
    if (this.isJobAlert(subject, body, from)) {
      console.log(`[MailAgent] Filtered out job alert email: "${subject}"`)
      return EmailEventType.UNKNOWN
    }

    const text = `${subject} ${body}`.toLowerCase()
    const sender = from.toLowerCase()

    // 1. Offer
    if (
      /job offer|pleased to offer|delighted to offer|congratulations on your offer|offer letter/i.test(subject) ||
      (/formal offer|extend an offer|offer of employment/i.test(body) && !/job alert/i.test(subject))
    ) {
      return EmailEventType.OFFER
    }

    // 2. Rejection
    if (
      /unfortunately|not moving forward|unsuccessful|decided not to proceed|pursuing other candidates|position has been filled|application status: rejected/i.test(text) &&
      !/interview/i.test(subject)
    ) {
      return EmailEventType.REJECTION
    }

    // 3. Interview / Employer Message
    if (
      /interview invitation|invite you to an interview|schedule an interview|interview scheduled|phone interview|teams interview|video call|new message from/i.test(subject) ||
      (/invite you to an interview|would like to speak with you|arrange a phone call/i.test(body) && !/job alert/i.test(subject))
    ) {
      return EmailEventType.INTERVIEW_SCHEDULED
    }

    // 4. Assessment / Testing
    if (
      /online assessment|dbs check|screening questionnaire|skills assessment|work trial|complete the following assessment/i.test(text)
    ) {
      return EmailEventType.OA_SENT
    }

    // 5. Application Confirmation (Indeed Apply, Reed, LinkedIn, Direct)
    if (
      /indeed application:|application submitted|application received|thank you for applying|thanks for applying|we received your application|application confirmation|you applied to/i.test(subject) ||
      (/your application has been submitted|application was sent to|thank you for submitting your application to/i.test(body))
    ) {
      return EmailEventType.APPLICATION_RECEIVED
    }

    return EmailEventType.UNKNOWN
  }

  /**
   * Universally extracts role, company, and location from any email format
   */
  private extractDetails(
    subject: string,
    body: string,
    from: string
  ): { company: string | null; role: string | null; location: string | null } {
    let company: string | null = null
    let role: string | null = null
    let location: string | null = null

    // Pattern A: Indeed Apply format: "Indeed Application: [Job Title]"
    const indeedSubjMatch = subject.match(/Indeed Application:\s*([^\r\n–-]+)/i)
    if (indeedSubjMatch) {
      role = indeedSubjMatch[1].trim()
    }

    // Check body for Indeed's confirmation block:
    // "Application submitted <Job Title> <Company> - <Location>"
    const indeedBodyMatch = body.match(
      /Application submitted\s+([A-Za-z0-9\s/&,.'()-]+?)\s+([A-Z0-9][A-Za-z0-9\s&.,'-]+?)\s*-\s*([A-Za-z0-9\s,-]+?)(?:\s+(?:[0-9]+\s+reviews|The following items|Good luck)|$)/i
    )
    if (indeedBodyMatch) {
      if (!role) role = indeedBodyMatch[1].trim()
      company = indeedBodyMatch[2].trim()
      location = indeedBodyMatch[3].trim()
    }

    // If role was found in subject, extract company directly following role in body
    if (role && (!company || company.toLowerCase() === "unknown employer")) {
      const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const afterRoleMatch = body.match(new RegExp(`${escapedRole}\\s+([A-Z0-9][A-Za-z0-9\\s&.,'-]+?)\\s*-\\s*([A-Za-z0-9\\s,-]+)`, "i"))
      if (afterRoleMatch) {
        company = afterRoleMatch[1].trim()
        location = afterRoleMatch[2].replace(/[0-9]+\s+reviews/i, "").trim()
      }
    }

    // Pattern B: "New message from <Company> – <Role>"
    const newMsgMatch = subject.match(/New message from\s+([^–-]+?)\s*[–-]\s*([^\r\n]+)/i)
    if (newMsgMatch) {
      company = newMsgMatch[1].trim()
      role = newMsgMatch[2].trim()
    }

    // Pattern C: "Your application was sent to <Company>"
    if (!company) {
      const sentMatch = body.match(/(?:sent to|submitted to|received by)\s+([A-Z0-9][A-Za-z0-9\s&.,'-]+?)(?:\.|\s+Good luck|\s+•)/i)
      if (sentMatch) {
        company = sentMatch[1].trim()
      }
    }

    // Pattern D: "Thank you for applying to <Company> for <Role>"
    if (!company || !role) {
      const applyForMatch = subject.match(/applying (?:to|at)\s+([A-Za-z0-9\s&.,'-]+?)\s+for\s+([A-Za-z0-9\s/&,.'()-]+)/i)
      if (applyForMatch) {
        company = applyForMatch[1].trim()
        role = applyForMatch[2].trim()
      }
    }

    // Pattern E: "Role @ Company" (e.g., "Care Assistant @ Holmes Care Group")
    if (!company || !role) {
      const atMatch = subject.match(/([A-Za-z0-9\s/&,.'()-]+?)\s+(?:@|at)\s+([A-Za-z0-9\s&.,'-]+)/i)
      if (atMatch) {
        if (!role) role = atMatch[1].trim()
        if (!company) company = atMatch[2].trim()
      }
    }

    // Pattern F: Fallback sender extraction if company is missing
    if (!company) {
      const fromNameMatch = from.match(/^"?([^"<]+)"?\s*</)
      if (fromNameMatch) {
        const senderName = fromNameMatch[1].trim()
        if (!/indeed|reed|totaljobs|linkedin|do not reply|no-reply/i.test(senderName)) {
          company = senderName
        }
      }
    }

    // Pattern G: Candidate's target role or search keyword match in text if role is still unresolved
    if (!role && this.targetRole) {
      const lowerText = `${subject} ${body}`.toLowerCase()
      if (lowerText.includes(this.targetRole.toLowerCase())) {
        role = this.targetRole
      } else if (this.searchKeywords.length > 0) {
        const foundKw = this.searchKeywords.find((kw) => lowerText.includes(kw.toLowerCase()))
        if (foundKw) {
          role = foundKw.charAt(0).toUpperCase() + foundKw.slice(1)
        }
      }
    }

    // Clean up extracted values
    if (company) {
      company = company.replace(/^(?:the\s+)?/i, "").trim()
      company = company.replace(/\s+/g, " ")

      // Never allow an email address or sender domain to become the company name!
      if (
        company.includes("@") ||
        /\.(com|co\.uk|org|net|io|gov|edu)$/i.test(company) ||
        /^(indeed|reed|totaljobs|linkedin|glassdoor|job alert|alerts|notifications|no-reply|noreply|mailer|donotreply)/i.test(
          company
        )
      ) {
        // Try extracting business name from domain if it's a direct employer email (e.g. info@acmecare.co.uk -> Acme Care)
        const domainMatch = company.match(/@([a-zA-Z0-9-]+)\./)
        if (
          domainMatch &&
          !/indeed|reed|totaljobs|linkedin|gmail|yahoo|hotmail|outlook|google|icloud/i.test(
            domainMatch[1]
          )
        ) {
          const raw = domainMatch[1].replace(/[-_]/g, " ")
          company = raw.charAt(0).toUpperCase() + raw.slice(1)
        } else {
          company = null
        }
      }
    }

    if (role) {
      role = role.replace(/\s+/g, " ").trim()
      if (role.includes("@") || role.length > 100) {
        role = this.targetRole || "Candidate"
      }
    }

    return { company, role, location }
  }

  /**
   * Find existing application matching company or role
   */
  private async findExistingApplication(company: string, role: string): Promise<Application | null> {
    const applications = await getApplications(this.userId)
    const normCompany = company.toLowerCase().trim()
    const normRole = role.toLowerCase().trim()

    return (
      applications.find((app) => {
        const appComp = app.company_name.toLowerCase().trim()
        const appRole = app.job_title.toLowerCase().trim()

        const companyMatch =
          appComp === normCompany ||
          appComp.includes(normCompany) ||
          normCompany.includes(appComp)

        const roleMatch =
          !role ||
          appRole === normRole ||
          appRole.includes(normRole) ||
          normRole.includes(appRole)

        return companyMatch && roleMatch
      }) || null
    )
  }

  /**
   * Handle APPLICATION_RECEIVED
   */
  private async handleApplicationReceived(
    email: EmailParsed,
    company: string,
    role: string,
    location: string | null,
    existing: Application | null
  ): Promise<Application> {
    if (existing) {
      // If company was previously "Unknown Employer" and we now have the real company, update it
      if (existing.company_name.toLowerCase().includes("unknown") && company && !company.toLowerCase().includes("unknown")) {
        await updateApplication(existing.id, {
          company_name: company,
          location: location || existing.location,
        })
        existing.company_name = company
      }
      return existing
    }

    const newApp = await createApplication({
      user_id: this.userId,
      company_name: company,
      job_title: role,
      applied_date: new Date(email.timestamp).toISOString().split("T")[0],
      current_status: ApplicationStatus.APPLIED,
      location: location || null,
      source_site: email.from.includes("indeed") ? "Indeed" : "Email Sync",
      easy_apply: true,
      salary_min: null,
      salary_max: null,
      job_url: null,
      description: `Application for ${role} at ${company} (detected via email sync)`,
      last_update: new Date().toISOString(),
      days_in_stage: 0,
    })

    if (newApp) {
      await createStatusHistory({
        application_id: newApp.id,
        user_id: this.userId,
        old_status: null,
        new_status: ApplicationStatus.APPLIED,
        reason: "Detected application confirmation email",
        notes: `Parsed application confirmation for ${role} at ${company}`,
        email_subject: email.subject.substring(0, 150),
        email_body: null,
        detected_by: "MailAgent",
      })
    }

    return newApp!
  }

  /**
   * Transition application status on interview, offer, or rejection
   */
  private async handleStatusTransition(
    existing: Application | null,
    company: string,
    role: string,
    newStatus: ApplicationStatus,
    reason: string,
    email: EmailParsed
  ): Promise<Application> {
    let app = existing

    if (!app) {
      app = await createApplication({
        user_id: this.userId,
        company_name: company,
        job_title: role,
        applied_date: new Date(email.timestamp).toISOString().split("T")[0],
        current_status: newStatus,
        location: null,
        source_site: "Email Sync",
        easy_apply: false,
        salary_min: null,
        salary_max: null,
        job_url: null,
        description: `Application for ${role} at ${company} (status updated to ${newStatus})`,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
      })
    } else if (app.current_status !== newStatus) {
      await updateApplication(app.id, {
        current_status: newStatus,
        last_update: new Date().toISOString(),
        days_in_stage: 0,
      })
    }

    if (app) {
      await createStatusHistory({
        application_id: app.id,
        user_id: this.userId,
        old_status: existing?.current_status || null,
        new_status: newStatus,
        reason,
        notes: `Status update: ${newStatus} for ${role} at ${company}`,
        email_subject: email.subject.substring(0, 150),
        email_body: null,
        detected_by: "MailAgent",
      })
    }

    return app!
  }
}
