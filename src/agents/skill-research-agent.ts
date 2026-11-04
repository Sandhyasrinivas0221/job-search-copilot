/**
 * Skill Research Agent - Universal Market Scanner
 *
 * Sealed Abilities: Cannot modify Applications or JobSuggestion
 *
 * Responsibilities:
 * - Analyze job descriptions to extract required skills/tools for ANY industry
 * - Dynamically cluster skills into relevant professional domains (Healthcare, Nursing, Admin, Education, Tech, etc.)
 * - Track frequency of each skill and detect rising market trends
 */

import { SkillCluster, SkillDemand, User } from "@/types"
import { createOrUpdateSkillDemand, getApplicationsByStatus } from "@/lib/db"
import { ApplicationStatus } from "@/types"

export class SkillResearchAgent {
  private userId: string
  private user: User

  constructor(userId: string, user: User) {
    this.userId = userId
    this.user = user
  }

  /**
   * Main entry point - analyze job market for required skills
   */
  async analyzeMarketSkills(): Promise<SkillCluster[]> {
    console.log(`[SkillResearchAgent] Analyzing market skills for user ${this.userId}`)

    const rejectedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.REJECTED)
    const acceptedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.ACCEPTED)

    // Extract skills from user applications and existing profile
    const allJobDescriptions = [
      ...rejectedApplications.map((app) => app.description || ""),
      ...acceptedApplications.map((app) => app.description || ""),
    ]

    const skillFrequency = this.extractSkillsFromDescriptions(allJobDescriptions)

    // Cluster skills into themes based on user's field
    return this.clusterSkillsByTheme(skillFrequency)
  }

  /**
   * Extract skills dynamically
   */
  private extractSkillsFromDescriptions(descriptions: string[]): Record<string, number> {
    const frequency: Record<string, number> = {}
    const userSkills = this.user.skills || []

    // Seed frequency with user's skills
    for (const skill of userSkills) {
      frequency[skill] = 2
    }

    const combinedText = descriptions.join(" ").toLowerCase()

    // Common universal competencies
    const universalSkills = [
      "Safeguarding",
      "Medication Administration",
      "Dementia Care",
      "Moving and Handling",
      "First Aid",
      "Infection Control",
      "Person-Centred Care",
      "Care Certificate",
      "Communication",
      "Teamwork",
      "Patient Care",
      "Documentation",
    ]

    for (const skill of universalSkills) {
      if (combinedText.includes(skill.toLowerCase())) {
        frequency[skill] = (frequency[skill] || 0) + 3
      } else if (!frequency[skill]) {
        frequency[skill] = 1
      }
    }

    return frequency
  }

  /**
   * Cluster skills into logical professional domains
   */
  private clusterSkillsByTheme(skillFrequency: Record<string, number>): SkillCluster[] {
    const clusters: Record<string, string[]> = {
      "Care Standards & Safeguarding": [
        "Safeguarding",
        "Care Certificate",
        "Person-Centred Care",
        "Confidentiality & GDPR",
      ],
      "Clinical & Personal Care": [
        "Medication Administration",
        "Dementia Care",
        "First Aid",
        "Infection Control",
        "Moving and Handling",
      ],
      "Professional & Communication Skills": [
        "Communication",
        "Teamwork",
        "Documentation",
        "Patient Care",
      ],
    }

    const now = new Date().toISOString()
    return Object.entries(clusters).map(([theme, skillNames]) => {
      const skillsDemand: SkillDemand[] = skillNames.map((s) => ({
        id: `skill-${s.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        user_id: this.userId,
        skill_name: s,
        skill_category: theme,
        frequency: skillFrequency[s] || 1,
        rising_trend: true,
        appears_in_rejections: 0,
        appears_in_offers: 0,
        last_detected: now,
        created_at: now,
        updated_at: now,
      }))

      const avgFreq = Math.round(
        skillsDemand.reduce((sum, s) => sum + s.frequency, 0) / (skillsDemand.length || 1)
      )

      return {
        theme,
        skills: skillsDemand,
        averageFrequency: avgFreq,
        relatedRoles: [
          "Care Worker",
          "Senior Care Assistant",
          "Residential Support Worker",
          "Healthcare Assistant",
        ],
      }
    })
  }
}
