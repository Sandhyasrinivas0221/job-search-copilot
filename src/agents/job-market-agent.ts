/**
 * Job Market Agent - Role Finder
 *
 * Sealed Abilities: Cannot submit applications or modify Applications table
 *
 * Responsibilities:
 * - Search multiple job sites (APIs or scraping) using user skills/preferences
 * - Classify: EASY_APPLY vs MANUAL_APPLY
 * - Store: title, company, location, salary, sourceSite, jobLink, easyApply, createdAt
 *
 * Escalation:
 * - If high rejection rate, widen search; if offers increase, prioritize similar roles
 */

import { User, JobListingRaw, JobSuggestion } from "@/types"
import { createJobSuggestion, getJobSuggestions } from "@/lib/db"

export class JobMarketAgent {
  private userId: string
  private user: User

  constructor(userId: string, user: User) {
    this.userId = userId
    this.user = user
  }

  /**
   * Main entry point - search for jobs matching user's profile
   * Sealed: Cannot submit applications or modify Applications table
   */
  async findJobsForUser(): Promise<JobSuggestion[]> {
    console.log(`[JobMarketAgent] Finding jobs for user ${this.userId}`)

    const jobListings = await this.searchJobs()
    console.log(`[JobMarketAgent] Found ${jobListings.length} job listings`)

    const suggestions: JobSuggestion[] = []

    for (const listing of jobListings) {
      try {
        const suggestion = await this.createJobSuggestion(listing)
        suggestions.push(suggestion)
      } catch (error) {
        console.error(`[JobMarketAgent] Error creating suggestion for ${listing.title} at ${listing.company}:`, error)
      }
    }

    return suggestions
  }

  /**
   * Search for jobs from multiple sources
   */
  private async searchJobs(): Promise<JobListingRaw[]> {
    console.log(`[JobMarketAgent] Searching jobs with skills: ${this.user.skills.join(", ")}`)

    const jobs: JobListingRaw[] = []

    // Simulate searching from multiple job boards
    // In production, these would call real APIs or use web scraping

    // Indeed-like results
    jobs.push(...this.simulateIndeedResults())

    // LinkedIn-like results
    jobs.push(...this.simulateLinkedInResults())

    // GitHub Jobs-like results
    jobs.push(...this.simulateGitHubJobsResults())

    // Remove duplicates
    return this.deduplicateJobs(jobs)
  }

  /**
   * Simulate Indeed job search results
   */
  private simulateIndeedResults(): JobListingRaw[] {
    const roles = [
      {
        title: "Senior Software Engineer",
        company: "TechCorp",
        location: "San Francisco, CA",
        salary: "$150k - $200k",
        description: "Looking for an experienced software engineer with Java and Spring Boot experience.",
        source: "indeed",
      },
      {
        title: "Full Stack Developer",
        company: "StartupXYZ",
        location: "New York, NY",
        salary: "$120k - $160k",
        description: "Full stack role using React, Node.js, and PostgreSQL. Remote friendly.",
        source: "indeed",
      },
    ]

    return roles.map((role) => ({
      ...role,
      url: `https://indeed.com/jobs?q=${role.title.replace(/\s/g, "+")}`,
      easyApply: Math.random() > 0.5,
    }))
  }

  /**
   * Simulate LinkedIn job search results
   */
  private simulateLinkedInResults(): JobListingRaw[] {
    const roles = [
      {
        title: "Backend Engineer",
        company: "CloudSystems",
        location: "Seattle, WA",
        salary: "$130k - $170k",
        description: "Build scalable backend systems using Microservices architecture.",
        source: "linkedin",
      },
      {
        title: "DevOps Engineer",
        company: "InfraCloud",
        location: "Austin, TX",
        salary: "$110k - $150k",
        description: "Manage cloud infrastructure and CI/CD pipelines on AWS.",
        source: "linkedin",
      },
    ]

    return roles.map((role) => ({
      ...role,
      url: `https://linkedin.com/jobs/search?keywords=${role.title.replace(/\s/g, "%20")}`,
      easyApply: Math.random() > 0.6,
    }))
  }

  /**
   * Simulate GitHub Jobs results
   */
  private simulateGitHubJobsResults(): JobListingRaw[] {
    const roles = [
      {
        title: "React Developer",
        company: "WebStudio",
        location: "Remote",
        salary: "$100k - $140k",
        description: "Frontend focused role with React, TypeScript, and modern tooling.",
        source: "github-jobs",
      },
    ]

    return roles.map((role) => ({
      ...role,
      url: "https://github.com/jobs",
      easyApply: false,
    }))
  }

  /**
   * Remove duplicate job listings
   */
  private deduplicateJobs(jobs: JobListingRaw[]): JobListingRaw[] {
    const seen = new Set<string>()
    return jobs.filter((job) => {
      const key = `${job.title}-${job.company}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Create job suggestion from listing
   */
  private async createJobSuggestion(listing: JobListingRaw): Promise<JobSuggestion> {
    // Calculate match score based on skills overlap
    const matchScore = this.calculateMatchScore(listing)

    // Check for duplicate
    const existingSuggestions = await getJobSuggestions(this.userId, false, false)
    const isDuplicate = existingSuggestions.some((s) => s.job_url === listing.url)

    if (isDuplicate) {
      console.log(`[JobMarketAgent] Job already exists: ${listing.title} at ${listing.company}`)
      throw new Error("Job already exists")
    }

    const suggestion = await createJobSuggestion({
      user_id: this.userId,
      job_title: listing.title,
      company_name: listing.company,
      location: listing.location,
      salary_min: this.extractSalaryMin(listing.salary),
      salary_max: this.extractSalaryMax(listing.salary),
      description: listing.description,
      job_url: listing.url,
      source_site: listing.source,
      easy_apply: listing.easyApply,
      match_score: matchScore,
      applied: false,
      dismissed: false,
    })

    console.log(`[JobMarketAgent] Created suggestion: ${listing.title} at ${listing.company} (score: ${matchScore})`)

    return suggestion!
  }

  /**
   * Calculate match score based on skills overlap
   */
  private calculateMatchScore(listing: JobListingRaw): number {
    const content = `${listing.title} ${listing.description}`.toLowerCase()

    let matches = 0
    for (const skill of this.user.skills) {
      if (content.includes(skill.toLowerCase())) {
        matches++
      }
    }

    return Math.min(100, (matches / Math.max(this.user.skills.length, 1)) * 100)
  }

  /**
   * Extract minimum salary from string
   */
  private extractSalaryMin(salaryStr: string | null): number | null {
    if (!salaryStr) return null

    const match = salaryStr.match(/\$?([\d,]+)/)
    if (match) {
      return parseInt(match[1].replace(/,/g, ""))
    }
    return null
  }

  /**
   * Extract maximum salary from string
   */
  private extractSalaryMax(salaryStr: string | null): number | null {
    if (!salaryStr) return null

    const parts = salaryStr.split("-")
    if (parts.length > 1) {
      const match = parts[1].match(/\$?([\d,]+)/)
      if (match) {
        return parseInt(match[1].replace(/,/g, ""))
      }
    }
    return null
  }
}
