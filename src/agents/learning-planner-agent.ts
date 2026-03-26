/**
 * Learning Planner Agent - Gap Closer
 *
 * Sealed Abilities: Cannot apply to jobs, cannot change statuses
 *
 * Responsibilities:
 * - Combine SkillDemand data + rejection history + failure stages
 * - Generate weekly learning plans (topics, resources, practice tasks)
 * - Produce interview prep packs per role (expected questions + model answers)
 * - Generate PDF/HTML learning documents linked to applications
 *
 * Escalation:
 * - If repeated rejections at same stage, increase focus on that area
 */

import { LearningPlanItem, InterviewPrepPack, LearningTask, SkillDemand, Application, ApplicationStatus } from "../types"
import { getTrendingSkills, createLearningTask, getApplicationsByStatus, getLearningTasks } from "../lib/db"
import { getSkillPath, getResourcesByDifficulty, ALL_SKILL_PATHS, LearningResource, SkillPath } from "../lib/learning-resources"

const INTERVIEW_QUESTIONS: Record<string, string[]> = {
  "System Design": [
    "Design a URL shortening service like bit.ly",
    "Design a chat messaging system",
    "Design an e-commerce platform",
    "Design a social media feed",
    "Design a distributed cache",
  ],
  "Behavioral/Soft Skills": [
    "Tell me about a time you handled conflict with a teammate",
    "Describe a situation where you had to learn something new quickly",
    "Tell me about your greatest achievement",
    "How do you handle failure?",
    "Describe your approach to solving a difficult problem",
  ],
  "Data Structures & Algorithms": [
    "Implement a binary search tree",
    "Solve the longest substring without repeating characters",
    "Design a LRU cache",
    "Merge K sorted lists",
    "Find the median of two sorted arrays",
  ],
  "Microservices": [
    "How would you design a microservices architecture?",
    "How do you handle service discovery?",
    "What are the challenges of distributed transactions?",
    "How do you monitor a microservices system?",
    "How do you handle versioning in APIs?",
  ],
}

export class LearningPlannerAgent {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Main entry point - generate learning plans based on market demand and rejection patterns
   * Sealed: Cannot apply to jobs, cannot change statuses
   */
  async generateWeeklyLearningPlan(): Promise<LearningPlanItem[]> {
    console.log(`[LearningPlannerAgent] Generating weekly learning plan for user ${this.userId}`)

    // Get trending skills
    const trendingSkills = await getTrendingSkills(this.userId)

    // Get rejection history to identify weak areas
    const rejectedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.REJECTED)

    // Create learning plan items
    const planItems: LearningPlanItem[] = []

    // Prioritize trending skills
    for (const skill of trendingSkills.slice(0, 3)) {
      const planItem = await this.createLearningPlanItem(skill)
      planItems.push(planItem)
    }

    // Add interview prep
    const interviewPrepPlans = await this.createInterviewPrepPlans(rejectedApplications)
    planItems.push(
      ...interviewPrepPlans.map((prep) => ({
        topic: `Interview Prep: ${prep.role}`,
        tasks: [],
        estimatedHours: 5,
        resources: prep.studyResources,
        priority: "HIGH" as const,
      }))
    )

    return planItems
  }

  /**
   * Create a learning plan item for a specific skill using curated resources
   */
  private async createLearningPlanItem(skill: SkillDemand): Promise<LearningPlanItem> {
    // Get the curated skill path from the learning resources library
    const skillPath = getSkillPath(skill.skill_category || skill.skill_name)

    let resources: string[] = []
    let estimatedHours = 10

    if (skillPath) {
      // Use curated resources from the skill path
      // Select resources based on trending status (intermediate for trending, beginner for others)
      const difficultyLevel = skill.rising_trend ? "INTERMEDIATE" : "BEGINNER"
      const selectedResources = getResourcesByDifficulty(skillPath, difficultyLevel)

      // Convert LearningResource objects to URLs for database storage
      resources = selectedResources.map(
        (r) => `${r.title} - ${r.url} (${r.platform}, ${r.estimatedHours}h)`
      )

      // Calculate total estimated hours based on progression
      // Beginner: start with beginner resources, then intermediate
      // Intermediate: intermediate + advanced
      if (skill.rising_trend) {
        const intermediate = getResourcesByDifficulty(skillPath, "INTERMEDIATE")
        estimatedHours =
          selectedResources.reduce((sum, r) => sum + r.estimatedHours, 0) +
          intermediate.slice(0, 2).reduce((sum, r) => sum + r.estimatedHours, 0)
      } else {
        estimatedHours = selectedResources.reduce((sum, r) => sum + r.estimatedHours, 0)
      }
    } else {
      // Fallback if skill path not found
      resources = [
        `Learn ${skill.skill_name} - Official Documentation`,
        `${skill.skill_name} Deep Dive Article`,
        `${skill.skill_name} Practice Exercises`,
      ]
    }

    const task = await createLearningTask({
      user_id: this.userId,
      application_id: null,
      title: `Master ${skill.skill_name}`,
      description: `Learn and practice ${skill.skill_name}. This skill appears in ${skill.frequency} job listings and is${skill.rising_trend ? " trending in the market." : " important for opportunities."} Follow the structured learning path from fundamentals through advanced topics.`,
      topic: skill.skill_category || skill.skill_name,
      difficulty_level: skill.rising_trend ? "INTERMEDIATE" : "BEGINNER",
      estimated_hours: estimatedHours,
      resources: resources,
      notes: skillPath
        ? `Use the structured learning path: ${skillPath.overview}. Start with fundamentals, progress to real-world applications.`
        : null,
      completed_at: null,
      priority: skill.rising_trend ? "HIGH" : "MEDIUM",
      completed: false,
      due_date: this.calculateDueDate(14),
    })

    return {
      topic: skill.skill_category || skill.skill_name,
      tasks: task ? [task] : [],
      estimatedHours: estimatedHours,
      resources: resources,
      priority: skill.rising_trend ? "HIGH" : "MEDIUM",
    }
  }

  /**
   * Create interview prep packs for roles where rejections occurred
   */
  private async createInterviewPrepPlans(rejectedApplications: Application[]): Promise<InterviewPrepPack[]> {
    const prepPacks: InterviewPrepPack[] = []

    // Group rejections by company and role
    const rejectionsByRole = new Map<string, Application[]>()

    for (const app of rejectedApplications) {
      const key = `${app.job_title}-${app.company_name}`
      if (!rejectionsByRole.has(key)) {
        rejectionsByRole.set(key, [])
      }
      rejectionsByRole.get(key)!.push(app)
    }

    // Create prep packs for roles with multiple rejections
    for (const [role, apps] of rejectionsByRole) {
      if (apps.length >= 2) {
        const [jobTitle, company] = role.split("-")
        const jobTitleTrimmed = jobTitle.trim()
        const companyTrimmed = company.trim()

        // Get recommended resources based on job title
        let studyResources: string[] = []
        const recommendedSkillPaths = this.getSkillPathsForRole(jobTitleTrimmed)

        if (recommendedSkillPaths.length > 0) {
          // Use the first skill path's advanced resources for interview prep
          const path = recommendedSkillPaths[0]
          const advancedResources = getResourcesByDifficulty(path, "ADVANCED")
          studyResources = advancedResources
            .slice(0, 3)
            .map((r) => `${r.title} - ${r.url} (${r.platform})`)
        } else {
          // Fallback to system design resources
          const systemDesignPath = getSkillPath("system-design")
          if (systemDesignPath) {
            const advancedResources = getResourcesByDifficulty(systemDesignPath, "ADVANCED")
            studyResources = advancedResources
              .slice(0, 3)
              .map((r) => `${r.title} - ${r.url} (${r.platform})`)
          } else {
            studyResources = [
              "System Design Primer - https://github.com/donnemartin/system-design-primer",
              "ByteByteGo - https://www.youtube.com/watch?v=xpDnVSmNFwY",
            ]
          }
        }

        // Determine what level of interview prep is needed
        const prepPack: InterviewPrepPack = {
          role: jobTitleTrimmed,
          company: companyTrimmed,
          expectedQuestions: INTERVIEW_QUESTIONS["Behavioral/Soft Skills"].slice(0, 3),
          modelAnswers: this.generateModelAnswers(jobTitleTrimmed, companyTrimmed),
          studyResources: studyResources,
          practiceProblems: this.generatePracticeProblems(jobTitleTrimmed),
        }

        prepPacks.push(prepPack)

        // Create learning task for interview prep
        await createLearningTask({
          user_id: this.userId,
          application_id: apps[0].id,
          title: `Interview Prep: ${jobTitleTrimmed}`,
          description: `Prepare for ${jobTitleTrimmed} interviews at ${companyTrimmed}. Follow curated resources focused on advanced concepts and interview patterns. Practice with real problem sets.`,
          topic: "Interview Preparation",
          difficulty_level: "INTERMEDIATE",
          estimated_hours: 12,
          resources: studyResources,
          notes: `After rejections at ${companyTrimmed}, focus on advanced system design and technical depth. Complete all practice problems and mock interviews.`,
          completed_at: null,
          priority: "HIGH",
          completed: false,
          due_date: this.calculateDueDate(7),
        })

        console.log(`[LearningPlannerAgent] Created interview prep pack for ${jobTitleTrimmed} at ${companyTrimmed}`)
      }
    }

    return prepPacks
  }

  /**
   * Generate model answers for interview questions
   */
  private generateModelAnswers(jobTitle: string, company: string): Record<string, string> {
    return {
      "Why do you want to join us?": `I'm interested in ${company} because of your work in ${this.getCompanyFocus(company)}. The ${jobTitle} role aligns perfectly with my skills and career goals.`,

      "Tell me about a challenging project": `I worked on a project involving ${this.getRandomTechSkill(jobTitle)}. The challenge was scalability, and I solved it by implementing caching strategies and optimizing database queries.`,

      "How do you handle disagreements?": `I focus on understanding different perspectives. I present data-driven arguments and work collaboratively to find solutions that benefit the team and product.`,

      "What's your learning approach?": `I'm a proactive learner. I follow blogs, contribute to open source, and regularly practice coding problems to stay updated with industry trends.`,

      "Describe your technical expertise": `I specialize in ${jobTitle} with strong fundamentals in system design, data structures, and algorithms. I'm also experienced with various frameworks and tools relevant to this role.`,
    }
  }

  /**
   * Generate practice problems for interview prep
   */
  private generatePracticeProblems(jobTitle: string): string[] {
    const baseProblems = [
      "LeetCode Medium Array/String Problems",
      "LeetCode Medium Dynamic Programming Problems",
      "System Design: Design a Cache",
      "System Design: Design a Rate Limiter",
      "Coding Interview: Implement a Trie",
      "Coding Interview: Merge K Sorted Lists",
      "Behavioral: Tell me about a time you overcame a challenge",
    ]

    // Add role-specific problems
    if (jobTitle.toLowerCase().includes("senior")) {
      baseProblems.push(
        "Design a distributed system for the given use case",
        "Architecture Review: Identify bottlenecks and propose solutions"
      )
    }

    if (jobTitle.toLowerCase().includes("backend")) {
      baseProblems.push("Database Design: Design a schema for a complex domain", "API Design: Design a REST API")
    }

    if (jobTitle.toLowerCase().includes("frontend")) {
      baseProblems.push("Optimize React Component Performance", "Implement a Form with Validation")
    }

    return baseProblems
  }

  /**
   * Get skill paths relevant to a job role
   */
  private getSkillPathsForRole(jobTitle: string): SkillPath[] {
    const title = jobTitle.toLowerCase()
    const relevantPaths: SkillPath[] = []

    // Map job titles to relevant skill paths
    if (title.includes("frontend") || title.includes("react") || title.includes("vue") || title.includes("angular")) {
      const path = getSkillPath("frontend")
      if (path) relevantPaths.push(path)
    }

    if (title.includes("backend") || title.includes("java") || title.includes("spring")) {
      const javaPath = getSkillPath("java-core")
      const springPath = getSkillPath("spring-framework")
      if (javaPath) relevantPaths.push(javaPath)
      if (springPath) relevantPaths.push(springPath)
    }

    if (title.includes("microservices") || title.includes("devops") || title.includes("docker") || title.includes("kubernetes")) {
      const path = getSkillPath("microservices")
      if (path) relevantPaths.push(path)
    }

    if (title.includes("cloud") || title.includes("aws") || title.includes("gcp") || title.includes("azure")) {
      const path = getSkillPath("cloud")
      if (path) relevantPaths.push(path)
    }

    if (title.includes("system design") || title.includes("architect") || title.includes("senior")) {
      const path = getSkillPath("system-design")
      if (path) relevantPaths.push(path)
    }

    if (title.includes("database") || title.includes("sql") || title.includes("postgres")) {
      const path = getSkillPath("databases")
      if (path) relevantPaths.push(path)
    }

    // Default to system design if no match found
    if (relevantPaths.length === 0) {
      const defaultPath = getSkillPath("system-design")
      if (defaultPath) relevantPaths.push(defaultPath)
    }

    return relevantPaths
  }

  /**
   * Calculate due date for a learning task
   */
  private calculateDueDate(daysFromNow: number): string {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toISOString().split("T")[0]
  }

  /**
   * Get company focus area (mock)
   */
  private getCompanyFocus(company: string): string {
    const focusMap: Record<string, string> = {
      google: "scalable systems and AI/ML",
      amazon: "cloud infrastructure and AWS services",
      microsoft: "enterprise solutions and cloud",
      facebook: "social networks and distributed systems",
      meta: "social networks and distributed systems",
      apple: "mobile and user experience",
      netflix: "streaming at scale",
      uber: "distributed systems and real-time data",
      spotify: "music streaming and personalization",
    }

    return focusMap[company.toLowerCase()] || "innovative technology solutions"
  }

  /**
   * Get a random tech skill for the given role
   */
  private getRandomTechSkill(jobTitle: string): string {
    const skillMap: Record<string, string[]> = {
      backend: ["database optimization", "API design", "microservices architecture"],
      frontend: ["React performance optimization", "state management", "responsive design"],
      fullstack: ["system integration", "end-to-end testing", "deployment pipelines"],
      devops: ["container orchestration", "CI/CD pipelines", "infrastructure as code"],
      "system engineer": ["distributed systems", "network optimization", "kernel programming"],
      architect: ["system design", "scalability planning", "technology selection"],
    }

    for (const [key, skills] of Object.entries(skillMap)) {
      if (jobTitle.toLowerCase().includes(key)) {
        return skills[Math.floor(Math.random() * skills.length)]
      }
    }

    return "scalable system design"
  }
