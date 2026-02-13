/**
 * TypeScript types and interfaces for the Job Search Copilot
 * These types align with the Supabase schema and ensure type safety across the application
 */

// User Profile
export interface User {
  id: string
  email: string
  full_name: string | null
  profile_picture_url: string | null
  bio: string | null
  skills: string[]
  created_at: string
  updated_at: string
}

// Application Status enum
export enum ApplicationStatus {
  APPLIED = "APPLIED",
  SCREENING = "SCREENING",
  INTERVIEW = "INTERVIEW",
  OFFER = "OFFER",
  REJECTED = "REJECTED",
  ACCEPTED = "ACCEPTED",
  ARCHIVED = "ARCHIVED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  FOLLOW_UP_SUGGESTED = "FOLLOW_UP_SUGGESTED",
  NO_RESPONSE = "NO_RESPONSE",
}

// Job Application
export interface Application {
  id: string
  user_id: string
  company_name: string
  job_title: string
  job_url: string | null
  location: string | null
  salary_min: number | null
  salary_max: number | null
  description: string | null
  applied_date: string | null
  source_site: string | null
  easy_apply: boolean
  current_status: ApplicationStatus
  last_update: string
  days_in_stage: number
  created_at: string
  updated_at: string
}

// Status History Entry
export interface StatusHistory {
  id: string
  application_id: string
  user_id: string
  old_status: ApplicationStatus | null
  new_status: ApplicationStatus
  reason: string | null
  notes: string | null
  email_subject: string | null
  email_body: string | null
  detected_by: string | null
  created_at: string
}

// Job Suggestion
export interface JobSuggestion {
  id: string
  user_id: string
  job_title: string
  company_name: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  description: string | null
  job_url: string
  source_site: string | null
  easy_apply: boolean
  match_score: number
  applied: boolean
  dismissed: boolean
  created_at: string
  updated_at: string
}

// Skill Demand (Market Analysis)
export interface SkillDemand {
  id: string
  user_id: string
  skill_name: string
  skill_category: string | null
  frequency: number
  rising_trend: boolean
  appears_in_rejections: number
  appears_in_offers: number
  last_detected: string
  created_at: string
  updated_at: string
}

// Learning Task
export interface LearningTask {
  id: string
  user_id: string
  application_id: string | null
  title: string
  description: string | null
  topic: string | null
  difficulty_level: string | null
  estimated_hours: number | null
  resources: string[]
  notes: string | null
  completed: boolean
  completed_at: string | null
  due_date: string | null
  priority: "LOW" | "MEDIUM" | "HIGH"
  created_at: string
  updated_at: string
}

// Agent-specific types

// Mail Agent
export interface EmailParsed {
  from: string
  subject: string
  body: string
  timestamp: string
  detectedEvent: EmailEventType
}

export enum EmailEventType {
  APPLICATION_RECEIVED = "APPLICATION_RECEIVED",
  INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED",
  OFFER = "OFFER",
  REJECTION = "REJECTION",
  OA_SENT = "OA_SENT",
  FEEDBACK = "FEEDBACK",
  UNKNOWN = "UNKNOWN",
}

// Tracker Agent
export interface TrackerMetrics {
  applicationsByStage: Record<ApplicationStatus, number>
  applicationsWithoutUpdate: Application[]
  needsFollowUp: Application[]
  earlyRejections: Application[]
}

// Job Market Agent
export interface JobListingRaw {
  title: string
  company: string
  location: string
  salary: string | null
  description: string
  url: string
  source: string
  easyApply: boolean
}

// Skill Research Agent
export interface SkillCluster {
  theme: string
  skills: SkillDemand[]
  averageFrequency: number
  relatedRoles: string[]
}

// Learning Planner Agent
export interface LearningPlanItem {
  topic: string
  tasks: LearningTask[]
  estimatedHours: number
  resources: string[]
  priority: "LOW" | "MEDIUM" | "HIGH"
}

export interface InterviewPrepPack {
  role: string
  company: string
  expectedQuestions: string[]
  modelAnswers: Record<string, string>
  studyResources: string[]
  practiceProblems: string[]
}

// System Observer Agent
export interface DashboardMetrics {
  totalApplications: number
  applicationsThisWeek: number
  interviewRate: number
  offerRate: number
  rejectionRate: number
  averageDaysToInterview: number
  topCompanies: { company: string; count: number }[]
  topRejectionReasons: { reason: string; count: number }[]
  learningProgress: number
  upcomingInterviews: Application[]
  recentOffers: Application[]
}

export interface DailyEmailSummary {
  jobSuggestions: JobSuggestion[]
  easyApplyJobs: JobSuggestion[]
  manualApplyJobs: JobSuggestion[]
  interviewsToday: Application[]
  learningTasks: LearningTask[]
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
