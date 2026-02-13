/**
 * Skill Research Agent - Market Scanner
 *
 * Sealed Abilities: Cannot modify Applications or JobSuggestion
 *
 * Responsibilities:
 * - Analyze job descriptions to extract required skills/tools
 * - Cluster skills into themes (Java core, Spring, microservices, cloud, system design, testing, etc.)
 * - Track frequency of each skill and detect rising trends
 *
 * Escalation:
 * - If skill appears frequently but missing in profile → notify Learning Planner
 */

import { SkillDemand, SkillCluster, User } from "@/types"
import { createOrUpdateSkillDemand, getSkillDemands, getApplicationsByStatus } from "@/lib/db"
import { ApplicationStatus } from "@/types"

const SKILL_CLUSTERS: Record<string, string[]> = {
  "Java Core": ["java", "jvm", "jar", "maven", "gradle"],
  "Spring Framework": ["spring", "spring-boot", "spring-data", "spring-cloud", "spring-security"],
  Microservices: ["microservices", "spring-cloud", "docker", "kubernetes", "service-mesh"],
  Cloud: ["aws", "gcp", "azure", "cloud", "ec2", "s3", "lambda", "rds"],
  "System Design": ["system design", "scalability", "distributed systems", "architecture", "design patterns"],
  Testing: ["junit", "mockito", "testng", "testing", "unit test", "integration test", "test-driven development"],
  Databases: ["sql", "postgresql", "mysql", "mongodb", "cassandra", "redis", "database"],
  "DevOps & CI/CD": ["docker", "kubernetes", "jenkins", "gitlab-ci", "github-actions", "devops", "ci/cd"],
  Frontend: ["react", "angular", "vue", "javascript", "typescript", "html", "css"],
  "Soft Skills": ["communication", "leadership", "collaboration", "problem-solving", "analytical"],
}

export class SkillResearchAgent {
  private userId: string
  private user: User

  constructor(userId: string, user: User) {
    this.userId = userId
    this.user = user
  }

  /**
   * Main entry point - analyze job market for required skills
   * Sealed: Cannot modify Applications or JobSuggestion
   */
  async analyzeMarketSkills(): Promise<SkillCluster[]> {
    console.log(`[SkillResearchAgent] Analyzing market skills for user ${this.userId}`)

    // Get job descriptions from applications and suggestions
    const rejectedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.REJECTED)
    const acceptedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.ACCEPTED)

    // Extract skills from all job descriptions
    const allJobDescriptions = [
      ...rejectedApplications.map((app) => app.description || ""),
      ...acceptedApplications.map((app) => app.description || ""),
    ]

    const skillFrequency = this.extractSkillsFromDescriptions(allJobDescriptions)

    // Detect trends and update skill demand
    await this.updateSkillDemands(skillFrequency, rejectedApplications, acceptedApplications)

    // Cluster skills into themes
    const clusters = this.clusterSkillsByTheme(skillFrequency)

    return clusters
  }

  /**
   * Extract skills from job descriptions
   */
  private extractSkillsFromDescriptions(descriptions: string[]): Map<string, number> {
    const skillFrequency = new Map<string, number>()

    for (const description of descriptions) {
      const content = description.toLowerCase()

      // Go through all known skills and count matches
      for (const [theme, skills] of Object.entries(SKILL_CLUSTERS)) {
        for (const skill of skills) {
          // Use word boundary matching to avoid partial matches
          const regex = new RegExp(`\\b${skill}\\b`, "gi")
          const matches = content.match(regex)

          if (matches) {
            const current = skillFrequency.get(skill) || 0
            skillFrequency.set(skill, current + matches.length)
          }
        }
      }

      // Also look for custom patterns
      this.extractCustomSkills(content, skillFrequency)
    }

    return skillFrequency
  }

  /**
   * Extract custom/additional skills from descriptions
   */
  private extractCustomSkills(content: string, skillFrequency: Map<string, number>): void {
    // Pattern for programming languages, frameworks, tools mentioned
    const patterns = [
      /(\w+\.js|node\.js|nodejs)/gi,
      /(python|golang|rust|c\+\+|c#|kotlin)/gi,
      /(apache|nginx|tomcat)/gi,
      /(git|svn|mercurial)/gi,
    ]

    for (const pattern of patterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          const skill = match.toLowerCase()
          const current = skillFrequency.get(skill) || 0
          skillFrequency.set(skill, current + 1)
        }
      }
    }
  }

  /**
   * Update skill demand database
   */
  private async updateSkillDemands(
    skillFrequency: Map<string, number>,
    rejectedApplications: any[],
    acceptedApplications: any[]
  ): Promise<void> {
    const existingSkills = await getSkillDemands(this.userId)
    const existingSkillMap = new Map(existingSkills.map((s) => [s.skill_name, s]))

    // Update or create skill demands
    for (const [skillName, frequency] of skillFrequency) {
      const existingSkill = existingSkillMap.get(skillName)

      // Count appearances in rejections and offers
      let appearsInRejections = 0
      let appearsInOffers = 0

      for (const app of rejectedApplications) {
        if (app.description?.toLowerCase().includes(skillName.toLowerCase())) {
          appearsInRejections++
        }
      }

      for (const app of acceptedApplications) {
        if (app.description?.toLowerCase().includes(skillName.toLowerCase())) {
          appearsInOffers++
        }
      }

      const isTrending =
        appearsInOffers > appearsInRejections && frequency > 3 // Trending if more in offers
        ? true
        : existingSkill?.rising_trend || false

      await createOrUpdateSkillDemand(this.userId, skillName, {
        frequency,
        rising_trend: isTrending,
        appears_in_rejections: appearsInRejections,
        appears_in_offers: appearsInOffers,
        skill_category: this.categorizeSkill(skillName),
      })

      console.log(`[SkillResearchAgent] Updated skill: ${skillName} (freq: ${frequency}, trending: ${isTrending})`)
    }
  }

  /**
   * Categorize a skill into a cluster
   */
  private categorizeSkill(skill: string): string | null {
    const skillLower = skill.toLowerCase()

    for (const [theme, skills] of Object.entries(SKILL_CLUSTERS)) {
      if (skills.some((s) => s.includes(skillLower) || skillLower.includes(s))) {
        return theme
      }
    }

    return null
  }

  /**
   * Cluster skills by theme
   */
  private clusterSkillsByTheme(skillFrequency: Map<string, number>): SkillCluster[] {
    const clusters: SkillCluster[] = []

    for (const [theme, skillPatterns] of Object.entries(SKILL_CLUSTERS)) {
      const themeSkills: SkillDemand[] = []
      let totalFrequency = 0

      for (const pattern of skillPatterns) {
        for (const [skill, frequency] of skillFrequency) {
          if (skill.toLowerCase().includes(pattern) || pattern.includes(skill.toLowerCase())) {
            themeSkills.push({
              id: "",
              user_id: this.userId,
              skill_name: skill,
              skill_category: theme,
              frequency,
              rising_trend: false,
              appears_in_rejections: 0,
              appears_in_offers: 0,
              last_detected: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            totalFrequency += frequency
          }
        }
      }

      if (themeSkills.length > 0) {
        clusters.push({
          theme,
          skills: themeSkills,
          averageFrequency: totalFrequency / themeSkills.length,
          relatedRoles: this.getRelatedRoles(theme),
        })
      }
    }

    return clusters.sort((a, b) => b.averageFrequency - a.averageFrequency)
  }

  /**
   * Get related job roles for a skill theme
   */
  private getRelatedRoles(theme: string): string[] {
    const roleMap: Record<string, string[]> = {
      "Java Core": ["Software Engineer", "Backend Developer", "Senior Engineer"],
      "Spring Framework": ["Backend Engineer", "Spring Boot Developer", "Java Architect"],
      Microservices: ["Microservices Architect", "Cloud Engineer", "DevOps Engineer"],
      Cloud: ["Cloud Architect", "DevOps Engineer", "Infrastructure Engineer"],
      "System Design": ["Senior Engineer", "Architect", "Tech Lead"],
      Testing: ["QA Engineer", "Test Automation Engineer", "Quality Assurance Lead"],
      Databases: ["Database Administrator", "Data Engineer", "Backend Developer"],
      "DevOps & CI/CD": ["DevOps Engineer", "CI/CD Engineer", "Release Manager"],
      Frontend: ["Frontend Engineer", "React Developer", "UI/UX Developer"],
      "Soft Skills": ["Team Lead", "Engineering Manager", "Technical Manager"],
    }

    return roleMap[theme] || []
  }
}
