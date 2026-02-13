/**
 * Workflow: Mail Listener Agent
 *
 * Monitors email inboxes and detects job application status changes.
 *
 * Sealed Abilities:
 * ✅ CAN: Read emails, create/update Applications, create StatusHistory
 * ❌ CANNOT: Send emails, apply to jobs
 *
 * Input: Email messages from Gmail/Outlook (via IMAP/OAuth API)
 * Output: Application + StatusHistory records in Supabase
 *
 * Escalation:
 * - Ambiguous emails → NEEDS_REVIEW status
 * - Missing company/role extraction → Log for manual review
 */

import { supabaseAdmin } from '@/lib/supabase'
import { Application, StatusHistory, EmailEventType, ApplicationStatus } from '@/types'
import { logAgentAction } from '@/lib/agent-logger'

// Email event detection patterns (case-insensitive)
const EMAIL_PATTERNS = {
  applicationReceived: [
    /confirmation.*receipt|received.*application|application.*confirm/i,
    /thanks.*applying|thank you for your interest|application.*submitted/i,
  ],
  interviewScheduled: [
    /interview.*scheduled|schedule.*interview|interview.*today|interview.*tomorrow/i,
    /meeting.*set|call.*scheduled|let's talk|technical round/i,
  ],
  offer: [
    /offer|congratul|excited to extend|we're pleased|we'd like to offer/i,
    /joining.*team|start date|compensation/i,
  ],
  rejection: [
    /reject|unfortunately|not move forward|decline|passing|don't go forward/i,
    /selected other candidates|pursued other candidates|other applicants/i,
  ],
  oaOrAssignment: [
    /coding challenge|assignment|take-home|assessment|OA|online assessment/i,
    /test.*available|complete.*test|problem.*solve/i,
  ],
  feedback: [
    /feedback|next round|advance|interview feedback|consideration/i,
  ],
}

export interface EmailParsed {
  from: string
  subject: string
  body: string
  timestamp: string
}

export interface MailListenerResult {
  success: boolean
  applicationsCreated: number
  applicationsUpdated: number
  escalations: number
  errors: string[]
}

/**
 * Main entry point for Mail Listener Agent
 */
export async function runMailListenerAgent(userId: string, emails: EmailParsed[]): Promise<MailListenerResult> {
  const result: MailListenerResult = {
    success: true,
    applicationsCreated: 0,
    applicationsUpdated: 0,
    escalations: 0,
    errors: [],
  }

  console.log(`[mail-listener-agent] Processing ${emails.length} emails for user ${userId}`)

  for (const email of emails) {
    try {
      await processEmail(userId, email, result)
    } catch (error) {
      const errorMsg = `Error processing email from ${email.from}: ${String(error)}`
      console.error(`[mail-listener-agent] ${errorMsg}`)
      result.errors.push(errorMsg)
      result.success = false
    }
  }

  // Log agent action
  await logAgentAction(userId, 'mail-listener-agent', {
    emails_processed: emails.length,
  }, result)

  console.log(`[mail-listener-agent] Completed. Created: ${result.applicationsCreated}, Updated: ${result.applicationsUpdated}, Escalations: ${result.escalations}`)
  return result
}

/**
 * Process a single email
 */
async function processEmail(userId: string, email: EmailParsed, result: MailListenerResult): Promise<void> {
  // Detect email event type
  const eventType = detectEmailEventType(email.subject, email.body)
  console.log(`[mail-listener-agent] Event detected: ${eventType} from ${email.from}`)

  // Extract company and role
  const { company, role } = extractCompanyAndRole(email.subject, email.body)

  if (!company) {
    // Escalate: Cannot extract company
    console.warn(`[mail-listener-agent] Could not extract company from email. Escalating.`)
    result.escalations++
    return
  }

  // Find or create application
  let application = await findExistingApplication(userId, company, role)

  // Handle different event types
  switch (eventType) {
    case EmailEventType.APPLICATION_RECEIVED:
      await handleApplicationReceived(userId, email, company, role, application, result)
      break

    case EmailEventType.INTERVIEW_SCHEDULED:
      await handleInterviewScheduled(userId, email, company, role, application, result)
      break

    case EmailEventType.OFFER:
      await handleOffer(userId, email, company, role, application, result)
      break

    case EmailEventType.REJECTION:
      await handleRejection(userId, email, company, role, application, result)
      break

    case EmailEventType.OA_SENT:
      await handleOAOrAssignment(userId, email, company, role, application, result)
      break

    case EmailEventType.FEEDBACK:
      await handleFeedback(userId, email, company, role, application,result)
      break

    case EmailEventType.UNKNOWN:
      // Escalate ambiguous email
      if (application) {
        await createStatusHistory(userId, application.id, application.current_status, ApplicationStatus.NEEDS_REVIEW, {
          reason: "Email event type unclear",
          notes: `Subject: ${email.subject}\n\nBody: ${email.body.substring(0, 500)}`,
          email_subject: email.subject,
          email_body: email.body,
        })
        result.escalations++
      }
      break
  }
}

/**
 * Detect email event type from content
 */
function detectEmailEventType(subject: string, body: string): EmailEventType {
  const content = `${subject} ${body}`.toLowerCase()

  for (const pattern of EMAIL_PATTERNS.offer) {
    if (pattern.test(content)) return EmailEventType.OFFER
  }

  for (const pattern of EMAIL_PATTERNS.rejection) {
    if (pattern.test(content)) return EmailEventType.REJECTION
  }

  for (const pattern of EMAIL_PATTERNS.interviewScheduled) {
    if (pattern.test(content)) return EmailEventType.INTERVIEW_SCHEDULED
  }

  for (const pattern of EMAIL_PATTERNS.oaOrAssignment) {
    if (pattern.test(content)) return EmailEventType.OA_SENT
  }

  for (const pattern of EMAIL_PATTERNS.applicationReceived) {
    if (pattern.test(content)) return EmailEventType.APPLICATION_RECEIVED
  }

  for (const pattern of EMAIL_PATTERNS.feedback) {
    if (pattern.test(content)) return EmailEventType.FEEDBACK
  }

  return EmailEventType.UNKNOWN
}

/**
 * Extract company and role from email
 */
function extractCompanyAndRole(subject: string, body: string): { company: string | null; role: string | null } {
  const subjectMatch = subject.match(/(?:from|at|with)\s+([A-Z][A-Za-z\s&.,-]+?)(?:\s+(?:for|role|position|job|–|-|:)|\s*$)/i)
  const company = subjectMatch ? subjectMatch[1].trim() : null

  const roleMatch = subject.match(/(?:for|role|position|job)\s+([A-Za-z\s]+?)(?:\s+(?:at|from|role|position)|\s*$)/i)
  const role = roleMatch ? roleMatch[1].trim() : null

  return { company, role }
}

/**
 * Find existing application by company and role
 */
async function findExistingApplication(userId: string, company: string, role: string | null): Promise<any | null> {
  const { data } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .eq('company_name', company)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data || null
}

/**
 * Create status history entry
 */
async function createStatusHistory(
  userId: string,
  applicationId: string,
  oldStatus: string | null,
  newStatus: ApplicationStatus,
  metadata: any
): Promise<StatusHistory | null> {
  const { data, error } = await supabaseAdmin
    .from('status_history')
    .insert([
      {
        application_id: applicationId,
        user_id: userId,
        old_status: oldStatus,
        new_status: newStatus,
        detected_by: 'mail-listener-agent',
        created_at: new Date().toISOString(),
        ...metadata,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('[mail-listener-agent] Error creating status history:', error)
    return null
  }
  return data
}

// ============= EVENT HANDLERS =============

async function handleApplicationReceived(
  userId: string,
  email: EmailParsed,
  company: string,
  role: string | null,
  application: any,
  result: MailListenerResult
): Promise<void> {
  console.log(`[mail-listener-agent] Handling APPLICATION_RECEIVED for ${company}`)

  if (!application) {
    // Create new application
    const { data } = await supabaseAdmin
      .from('applications')
      .insert([
        {
          user_id: userId,
          company_name: company,
          job_title: role || 'Unknown Role',
          applied_date: new Date().toISOString().split('T')[0],
          current_status: ApplicationStatus.APPLIED,
          last_update: new Date().toISOString(),
          days_in_stage: 0,
          source_site: 'email',
        },
      ])
      .select()
      .single()

    if (data) {
      application = data
      result.applicationsCreated++
    }
  } else if (application.current_status !== ApplicationStatus.APPLIED) {
    // Update to APPLIED status
    await supabaseAdmin
      .from('applications')
      .update({
        current_status: ApplicationStatus.APPLIED,
        last_update: new Date().toISOString(),
      })
      .eq('id', application.id)

    result.applicationsUpdated++
  }

  if (application) {
    await createStatusHistory(userId, application.id, null, ApplicationStatus.APPLIED, {
      reason: 'Application confirmation received',
      email_subject: email.subject,
      email_body: email.body,
    })
  }
}

async function handleInterviewScheduled(
  userId: string,
  email: EmailParsed,
  company: string,
  role: string | null,
  application: any,
  result: MailListenerResult
): Promise<void> {
  console.log(`[mail-listener-agent] Handling INTERVIEW_SCHEDULED for ${company}`)

  if (!application) {
    // Create new
    const { data } = await supabaseAdmin
      .from('applications')
      .insert([
        {
          user_id: userId,
          company_name: company,
          job_title: role || 'Unknown Role',
          applied_date: new Date().toISOString().split('T')[0],
          current_status: ApplicationStatus.INTERVIEW,
          last_update: new Date().toISOString(),
          source_site: 'email',
        },
      ])
      .select()
      .single()

    if (data) {
      application = data
      result.applicationsCreated++
    }
  } else {
    await supabaseAdmin
      .from('applications')
      .update({
        current_status: ApplicationStatus.INTERVIEW,
        last_update: new Date().toISOString(),
      })
      .eq('id', application.id)

    result.applicationsUpdated++
  }

  if (application) {
    await createStatusHistory(userId, application.id, application.current_status, ApplicationStatus.INTERVIEW, {
      reason: 'Interview scheduled',
      email_subject: email.subject,
      email_body: email.body,
    })
  }
}

async function handleOffer(
  userId: string,
  email: EmailParsed,
  company: string,
  role: string | null,
  application: any,
  result: MailListenerResult
): Promise<void> {
  console.log(`[mail-listener-agent] Handling OFFER for ${company}`)

  if (!application) {
    const { data } = await supabaseAdmin
      .from('applications')
      .insert([
        {
          user_id: userId,
          company_name: company,
          job_title: role || 'Unknown Role',
          applied_date: new Date().toISOString().split('T')[0],
          current_status: ApplicationStatus.OFFER,
          last_update: new Date().toISOString(),
          source_site: 'email',
        },
      ])
      .select()
      .single()

    if (data) {
      application = data
      result.applicationsCreated++
    }
  } else {
    await supabaseAdmin
      .from('applications')
      .update({
        current_status: ApplicationStatus.OFFER,
        last_update: new Date().toISOString(),
      })
      .eq('id', application.id)

    result.applicationsUpdated++
  }

  if (application) {
    await createStatusHistory(userId, application.id, application.current_status, ApplicationStatus.OFFER, {
      reason: 'Job offer received',
      email_subject: email.subject,
      email_body: email.body,
    })
  }
}

async function handleRejection(
  userId: string,
  email: EmailParsed,
  company: string,
  role: string | null,
  application: any,
  result: MailListenerResult
): Promise<void> {
  console.log(`[mail-listener-agent] Handling REJECTION for ${company}`)

  if (!application) {
    const { data } = await supabaseAdmin
      .from('applications')
      .insert([
        {
          user_id: userId,
          company_name: company,
          job_title: role || 'Unknown Role',
          applied_date: new Date().toISOString().split('T')[0],
          current_status: ApplicationStatus.REJECTED,
          last_update: new Date().toISOString(),
          source_site: 'email',
        },
      ])
      .select()
      .single()

    if (data) {
      application = data
      result.applicationsCreated++
    }
  } else {
    await supabaseAdmin
      .from('applications')
      .update({
        current_status: ApplicationStatus.REJECTED,
        last_update: new Date().toISOString(),
      })
      .eq('id', application.id)

    result.applicationsUpdated++
  }

  if (application) {
    await createStatusHistory(userId, application.id, application.current_status, ApplicationStatus.REJECTED, {
      reason: 'Rejection received',
      email_subject: email.subject,
      email_body: email.body,
    })
  }
}

async function handleOAOrAssignment(
  userId: string,
  email: EmailParsed,
  company: string,
  role: string | null,
  application: any,
  result: MailListenerResult
): Promise<void> {
  console.log(`[mail-listener-agent] Handling OA_SENT for ${company}`)

  if (!application) {
    const { data } = await supabaseAdmin
      .from('applications')
      .insert([
        {
          user_id: userId,
          company_name: company,
          job_title: role || 'Unknown Role',
          applied_date: new Date().toISOString().split('T')[0],
          current_status: ApplicationStatus.SCREENING,
          last_update: new Date().toISOString(),
          source_site: 'email',
        },
      ])
      .select()
      .single()

    if (data) {
      application = data
      result.applicationsCreated++
    }
  } else if (application.current_status === ApplicationStatus.APPLIED) {
    await supabaseAdmin
      .from('applications')
      .update({
        current_status: ApplicationStatus.SCREENING,
        last_update: new Date().toISOString(),
      })
      .eq('id', application.id)

    result.applicationsUpdated++
  }

  if (application) {
    await createStatusHistory(userId, application.id, application.current_status, ApplicationStatus.SCREENING, {
      reason: 'Coding challenge or assessment sent',
      email_subject: email.subject,
      email_body: email.body,
    })
  }
}

async function handleFeedback(
  userId: string,
  email: EmailParsed,
  company: string,
  role: string | null,
  application: any,
  result: MailListenerResult
): Promise<void> {
  console.log(`[mail-listener-agent] Handling FEEDBACK for ${company}`)

  if (application) {
    await createStatusHistory(userId, application.id, application.current_status, application.current_status, {
      reason: 'Feedback received',
      email_subject: email.subject,
      email_body: email.body,
    })
  }
}
