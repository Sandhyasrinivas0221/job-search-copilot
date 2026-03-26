/**
 * Learning Path Service - Phase 5
 *
 * Business logic layer that:
 * 1. Extracts job context from applications/emails
 * 2. Identifies skill gaps based on job requirements
 * 3. Analyzes market trends
 * 4. Recommends structured learning paths (FREE RESOURCES)
 * 5. Suggests easier transition roles
 * 6. Prioritizes by market demand & job relevance
 *
 * Integration Points:
 * - Mail Agent: Job descriptions from LinkedIn, applications, rejections
 * - Job Market Agent: Job listings with trends
 * - Learning Planner Agent: Generates learning tasks from recommendations
 * - Skill Research Agent: Market demand data
 */

import {
  Application,
  JobSuggestion,
  SkillDemand,
  LearningTask,
  ApplicationStatus,
  User,
} from "@/types"
import {
  ALL_SKILL_PATHS,
  getSkillPath,
  getResourcesByDifficulty,
  getAllResources,
  LearningResource,
  SkillPath,
} from "./learning-resources"
import { getUser, getTrendingSkills, getApplications, getJobSuggestions } from "./db"

/**
 * Structured learning recommendation with context
 */
export interface LearningPathRecommendation {
  jobId: string
  jobTitle: string
  company: string
  targetSkillPaths: SkillPathRecommendation[]
  skillGaps: SkillGap[]
  transitionRoles: TransitionRoleOption[]
  marketDemand: MarketContext
  totalEstimatedHours: number
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  reasoning: string
}

/**
 * Skill path with specific resources for this job
 */
export interface SkillPathRecommendation {
  skill: SkillPath
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  resources: LearningResource[]
  estimatedHours: number
  relevanceScore: number // 0-100: how important for this job
  marketDemand: number // frequency in market
}

/**
 * Identifies specific skill gaps
 */
export interface SkillGap {
  skillName: string
  skillCategory: string
  marketFrequency: number
  appearsInOffers: number
  appearsInRejections: number
  estimatedHoursToAcquire: number
  resources: LearningResource[]
  priority: "CRITICAL" | "HIGH" | "MEDIUM"
}

/**
 * Easier career transition path
 */
export interface TransitionRoleOption {
  title: string
  description: string
  requiredSkills: string[]
  currentSkillMatch: number // percentage of skills user already has
  estimatedMonthsToTransition: number
  targetCompanies: string[]
  recommendedLearningPath: SkillPath[]
}

/**
 * Market context for the job
 */
export interface MarketContext {
  demandLevel: "HIGH" | "MEDIUM" | "LOW"
  trendsAnalysis: string[]
  competitorSkills: string[]
  salaryRange: {
    min: number | null
    max: number | null
  }
}

/**
 * Main Learning Path Service
 */
export class LearningPathService {
  private userId: string
  private user: User | null = null
  private trendingSkills: SkillDemand[] = []

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Initialize service with user data
   */
  async initialize(): Promise<void> {
    this.user = await getUser(this.userId)
    this.trendingSkills = await getTrendingSkills(this.userId)
  }

  /**
   * Generate learning path recommendations for all active applications
   */
  async generateRecommendationsForAllApplications(): Promise<LearningPathRecommendation[]> {
    const applications = await getApplications(this.userId)

    // Filter to active applications (not rejected/archived)
    const activeApplications = applications.filter(
      (app) =>
        app.current_status !== ApplicationStatus.REJECTED &&
        app.current_status !== ApplicationStatus.ARCHIVED
    )

    const recommendations: LearningPathRecommendation[] = []

    for (const app of activeApplications.slice(0, 5)) {
      // Limit to 5 for performance
      const rec = await this.generateRecommendationForApplication(app)
      if (rec) recommendations.push(rec)
    }

    // Sort by priority and market demand
    return recommendations.sort((a, b) => {
      const priorityMap = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return priorityMap[a.priority] - priorityMap[b.priority]
    })
  }

  /**
   * Generate learning path for a specific job application
   */
  async generateRecommendationForApplication(
    application: Application
  ): Promise<LearningPathRecommendation | null> {
    const jobDescription = application.description || ""
    const jobTitle = application.job_title || ""

    // Extract required skills from job description
    const requiredSkills = this.extractSkillsFromJobDescription(jobDescription, jobTitle)

    if (requiredSkills.length === 0) {
      return null
    }

    // Identify skill gaps
    const skillGaps = await this.identifySkillGaps(requiredSkills)

    // Get market context
    const marketContext = await this.analyzeMarketContext(requiredSkills, jobTitle)

    // Map skills to learning paths
    const targetSkillPaths = await this.mapSkillsToPaths(requiredSkills, skillGaps)

    // Suggest transition roles
    const transitionRoles = this.suggestTransitionRoles(requiredSkills, targetSkillPaths)

    // Calculate priority
    const priority = this.calculatePriority(
      application.current_status,
      skillGaps.length,
      marketContext.demandLevel
    )

    const totalEstimatedHours = targetSkillPaths.reduce((sum, sp) => sum + sp.estimatedHours, 0)

    return {
      jobId: application.id,
      jobTitle: application.job_title || "Unknown Role",
      company: application.company_name || "Unknown Company",
      targetSkillPaths,
      skillGaps,
      transitionRoles,
      marketDemand: marketContext,
      totalEstimatedHours,
      priority,
      reasoning: this.generateReasoning(
        application,
        skillGaps,
        marketContext,
        totalEstimatedHours
      ),
    }
  }

  /**
   * Extract required skills from job description and title
   */
  private extractSkillsFromJobDescription(description: string, jobTitle: string): string[] {
    const text = `${jobTitle} ${description}`.toLowerCase()
    const extractedSkills = new Set<string>()

    // Keyword patterns for each skill category
    const skillPatterns: Record<string, string[]> = {
      "java-core": ["java", "oop", "concurrency", "jvm"],
      "spring-framework": ["spring", "spring boot", "dependency injection"],
      microservices: ["microservices", "docker", "kubernetes", "container"],
      cloud: ["aws", "gcp", "azure", "cloud", "terraform"],
      frontend: ["react", "vue", "angular", "javascript", "typescript", "css", "html"],
      "system-design": ["system design", "architecture", "scalability"],
      testing: ["testing", "junit", "mockito", "test automation", "tdd"],
      databases: ["sql", "postgres", "mysql", "mongodb", "redis"],
      "devops-ci-cd": ["devops", "ci/cd", "jenkins", "gitlab", "github actions"],
      "soft-skills": ["communication", "leadership", "mentoring", "presentation"],
    }

    for (const [skillKey, patterns] of Object.entries(skillPatterns)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          const skillPath = getSkillPath(skillKey)
          if (skillPath) {
            extractedSkills.add(skillKey)
          }
        }
      }
    }

    return Array.from(extractedSkills)
  }

  /**
   * Identify skill gaps by comparing required skills to user's current skills
   */
  private async identifySkillGaps(requiredSkills: string[]): Promise<SkillGap[]> {
    const userSkills = this.user?.skills || []
    const gaps: SkillGap[] = []

    for (const skillKey of requiredSkills) {
      const skillPath = getSkillPath(skillKey)
      if (!skillPath) continue

      // Find matching trending skill data
      const trendingSkill = this.trendingSkills.find(
        (ts) =>
          ts.skill_name.toLowerCase() === skillKey.toLowerCase() ||
          ts.skill_category?.toLowerCase() === skillKey.toLowerCase()
      )

      // Check if user already has this skill
      const hasSkill = userSkills.some(
        (s) =>
          s.toLowerCase() === skillPath.skillName.toLowerCase() ||
          s.toLowerCase() === skillKey.toLowerCase()
      )

      if (!hasSkill) {
        const resources = getAllResources(skillPath)
        gaps.push({
          skillName: skillPath.skillName,
          skillCategory: skillPath.skillCategory,
          marketFrequency: trendingSkill?.frequency || 0,
          appearsInOffers: trendingSkill?.appears_in_offers || 0,
          appearsInRejections: trendingSkill?.appears_in_rejections || 0,
          estimatedHoursToAcquire: this.estimateLearningHours(resources),
          resources: resources.slice(0, 5), // Top 5 resources
          priority: this.calculateSkillPriority(trendingSkill),
        })
      }
    }

    // Sort by priority
    const priorityMap = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 }
    return gaps.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority])
  }

  /**
   * Map required skills to learning paths
   */
  private async mapSkillsToPaths(
    requiredSkills: string[],
    skillGaps: SkillGap[]
  ): Promise<SkillPathRecommendation[]> {
    const recommendations: SkillPathRecommendation[] = []

    for (const skillKey of requiredSkills) {
      const skillPath = getSkillPath(skillKey)
      if (!skillPath) continue

      // Determine appropriate difficulty
      const gap = skillGaps.find((g) => g.skillCategory === skillPath.skillCategory)
      const difficulty = gap
        ? gap.priority === "CRITICAL"
          ? "BEGINNER"
          : "INTERMEDIATE"
        : "ADVANCED"

      const resources = getResourcesByDifficulty(skillPath, difficulty)
      const estimatedHours = this.estimateLearningHours(resources)

      // Calculate relevance based on trending data
      const trendingSkill = this.trendingSkills.find(
        (ts) =>
          ts.skill_name.toLowerCase() === skillKey.toLowerCase() ||
          ts.skill_category?.toLowerCase() === skillKey.toLowerCase()
      )

      const relevanceScore = this.calculateRelevanceScore(trendingSkill, gap)

      recommendations.push({
        skill: skillPath,
        difficulty,
        resources,
        estimatedHours,
        relevanceScore,
        marketDemand: trendingSkill?.frequency || 0,
      })
    }

    // Sort by relevance and market demand
    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * Analyze market context for trending skills and demand
   */
  private async analyzeMarketContext(
    requiredSkills: string[],
    jobTitle: string
  ): Promise<MarketContext> {
    const trends: string[] = []
    const competitors: string[] = []
    let demandLevel: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM"

    // Analyze trending skills
    const trendingCount = requiredSkills.filter(
      (skill) =>
        this.trendingSkills.find(
          (ts) =>
            ts.skill_name.toLowerCase() === skill.toLowerCase() ||
            ts.skill_category?.toLowerCase() === skill.toLowerCase()
        )?.rising_trend
    ).length

    if (trendingCount >= 2) {
      demandLevel = "HIGH"
      trends.push(`${trendingCount} trending skills in demand`)
    }

    // Identify key trending technologies
    for (const skill of requiredSkills) {
      const trending = this.trendingSkills.find(
        (ts) =>
          ts.skill_name.toLowerCase() === skill.toLowerCase() ||
          ts.skill_category?.toLowerCase() === skill.toLowerCase()
      )

      if (trending?.rising_trend) {
        trends.push(`${trending.skill_name} is trending in market`)
        competitors.push(trending.skill_name)
      }
    }

    // Analyze job title for market signals
    if (jobTitle.toLowerCase().includes("senior")) {
      trends.push("Senior role - emphasis on system design & architecture")
    }
    if (jobTitle.toLowerCase().includes("lead") || jobTitle.toLowerCase().includes("tech lead")) {
      trends.push("Leadership role - soft skills & mentoring valued")
    }

    return {
      demandLevel,
      trendsAnalysis: trends,
      competitorSkills: competitors,
      salaryRange: {
        min: null,
        max: null,
      },
    }
  }

  /**
   * Suggest easier career transition paths
   */
  private suggestTransitionRoles(
    requiredSkills: string[],
    skillPaths: SkillPathRecommendation[]
  ): TransitionRoleOption[] {
    const transitions: TransitionRoleOption[] = []

    // Common transition paths from different roles
    const transitionMap: Record<string, TransitionRoleOption[]> = {
      backend: [
        {
          title: "Full Stack Developer",
          description: "Transition from backend to full stack by learning frontend",
          requiredSkills: ["React", "JavaScript", "TypeScript"],
          currentSkillMatch: 60,
          estimatedMonthsToTransition: 3,
          targetCompanies: ["Startups", "Mid-size tech"],
          recommendedLearningPath: [getSkillPath("frontend")].filter(Boolean) as SkillPath[],
        },
        {
          title: "DevOps Engineer",
          description: "Transition to DevOps using backend infrastructure knowledge",
          requiredSkills: ["Docker", "Kubernetes", "CI/CD"],
          currentSkillMatch: 40,
          estimatedMonthsToTransition: 2,
          targetCompanies: ["Cloud-native companies", "SRE teams"],
          recommendedLearningPath: [getSkillPath("devops-ci-cd")].filter(
            Boolean
          ) as SkillPath[],
        },
      ],
      frontend: [
        {
          title: "Full Stack Developer",
          description: "Add backend skills to become full stack",
          requiredSkills: ["Node.js", "Express", "Databases"],
          currentSkillMatch: 50,
          estimatedMonthsToTransition: 4,
          targetCompanies: ["Full stack startups"],
          recommendedLearningPath: [getSkillPath("spring-framework")].filter(
            Boolean
          ) as SkillPath[],
        },
      ],
      microservices: [
        {
          title: "Cloud Architect",
          description: "Design cloud-native architectures",
          requiredSkills: ["AWS", "Terraform", "System Design"],
          currentSkillMatch: 70,
          estimatedMonthsToTransition: 2,
          targetCompanies: ["Enterprise cloud", "AWS partnerships"],
          recommendedLearningPath: [getSkillPath("cloud"), getSkillPath("system-design")].filter(
            Boolean
          ) as SkillPath[],
        },
      ],
    }

    // Find matching transitions based on required skills
    for (const [roleType, options] of Object.entries(transitionMap)) {
      if (requiredSkills.some((s) => s.toLowerCase().includes(roleType))) {
        transitions.push(...options)
      }
    }

    return transitions.slice(0, 2) // Return top 2 transition options
  }

  /**
   * Calculate priority based on application status and skill gaps
   */
  private calculatePriority(
    status: ApplicationStatus,
    gapCount: number,
    demandLevel: string
  ): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    if (status === ApplicationStatus.INTERVIEW && gapCount > 2) return "CRITICAL"
    if (status === ApplicationStatus.INTERVIEW && demandLevel === "HIGH") return "HIGH"
    if (gapCount > 3) return "HIGH"
    if (demandLevel === "HIGH") return "MEDIUM"
    return "LOW"
  }

  /**
   * Calculate priority for individual skill gaps
   */
  private calculateSkillPriority(skill: SkillDemand | undefined): "CRITICAL" | "HIGH" | "MEDIUM" {
    if (!skill) return "MEDIUM"
    if (skill.rising_trend && skill.appears_in_offers > 5) return "CRITICAL"
    if (skill.rising_trend || skill.frequency > 5) return "HIGH"
    return "MEDIUM"
  }

  /**
   * Calculate relevance score (0-100)
   */
  private calculateRelevanceScore(trend: SkillDemand | undefined, gap: SkillGap | undefined): number {
    let score = 50

    if (trend?.rising_trend) score += 25
    if (trend && trend.frequency > 5) score += 15
    if (gap?.priority === "CRITICAL") score += 10

    return Math.min(score, 100)
  }

  /**
   * Estimate learning hours for resources
   */
  private estimateLearningHours(resources: LearningResource[]): number {
    return resources.reduce((sum, r) => sum + r.estimatedHours, 0)
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    app: Application,
    gaps: SkillGap[],
    market: MarketContext,
    hours: number
  ): string {
    let reasoning = `For ${app.job_title} at ${app.company_name}: `

    if (gaps.length === 0) {
      reasoning += "You have strong skill alignment for this role. "
    } else {
      reasoning += `You have ${gaps.length} key skill gaps: ${gaps.map((g) => g.skillName).join(", ")}. `
    }

    if (market.demandLevel === "HIGH") {
      reasoning += "This role type is in HIGH market demand. "
    }

    reasoning += `Estimated learning time: ${hours} hours. `

    if (market.trendsAnalysis.length > 0) {
      reasoning += market.trendsAnalysis[0]
    }

    return reasoning
  }
}

/**
 * Utility function to generate learning tasks from recommendations
 */
export async function createLearningTasksFromRecommendations(
  recommendati: LearningPathRecommendation,
  createLearningTask: (task: any) => Promise<LearningTask | null>
): Promise<LearningTask[]> {
  const tasks: LearningTask[] = []

  for (const skillRec of recommendati.targetSkillPaths.slice(0, 3)) {
    // Create one task per top 3 skills
    const task = await createLearningTask({
      user_id: recommendati.jobId, // This would be set by caller
      application_id: recommendati.jobId,
      title: `Learn ${skillRec.skill.skillName} for ${recommendati.jobTitle}`,
      description: `Master ${skillRec.skill.skillName} to qualify for ${recommendati.jobTitle} at ${recommendati.company}. ${recommendati.reasoning}`,
      topic: skillRec.skill.skillCategory,
      difficulty_level: skillRec.difficulty,
      estimated_hours: skillRec.estimatedHours,
      resources: skillRec.resources.map((r) => `${r.title} - ${r.url} (${r.platform})`),
      priority: recommendati.priority,
      completed: false,
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    })

    if (task) tasks.push(task)
  }

  return tasks
}
