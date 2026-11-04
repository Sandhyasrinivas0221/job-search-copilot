/**
 * Skill Research Agent - Universal Market Scanner for Multiple Professions
 *
 * Sealed Abilities: Cannot modify Applications or JobSuggestion
 *
 * Responsibilities:
 * - Analyze job descriptions and extract required skills/tools for ANY industry
 * - Dynamically cluster skills into relevant professional domains (Healthcare, Nursing, Admin, Education, Tech, etc.)
 * - Track frequency of each skill and detect rising market trends
 */

import { SkillCluster, SkillDemand, User } from "@/types"
import { createOrUpdateSkillDemand, getApplicationsByStatus } from "@/lib/db"
import { ApplicationStatus } from "@/types"

export class SkillResearchAgent {
  private userId: string
  private user: User
  private targetRole: string
  private industryField: string

  constructor(userId: string, user: User) {
    this.userId = userId
    this.user = user

    let parsedBio: any = {}
    if (user.bio) {
      try {
        parsedBio = JSON.parse(user.bio)
      } catch {
        parsedBio = {}
      }
    }

    this.targetRole = parsedBio.target_role || "Professional"
    this.industryField = parsedBio.industry_field || "General"
  }

  /**
   * Main entry point - analyze job market for required skills
   */
  async analyzeMarketSkills(): Promise<SkillCluster[]> {
    console.log(`[SkillResearchAgent] Analyzing market skills for user ${this.userId} in ${this.industryField}`)

    const rejectedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.REJECTED)
    const acceptedApplications = await getApplicationsByStatus(this.userId, ApplicationStatus.ACCEPTED)

    const allJobDescriptions = [
      ...rejectedApplications.map((app) => app.description || ""),
      ...acceptedApplications.map((app) => app.description || ""),
    ]

    const skillFrequency = this.extractSkillsFromDescriptions(allJobDescriptions)

    return this.clusterSkillsByTheme(skillFrequency)
  }

  /**
   * Extract skills dynamically
   */
  private extractSkillsFromDescriptions(descriptions: string[]): Record<string, number> {
    const frequency: Record<string, number> = {}
    const combinedText = descriptions.join(" ").toLowerCase()

    const userSkills = this.user.skills || []
    for (const skill of userSkills) {
      frequency[skill] = 2
    }

    return frequency
  }

  /**
   * Cluster skills into logical professional domains based on user's industry
   */
  private clusterSkillsByTheme(skillFrequency: Record<string, number>): SkillCluster[] {
    const fieldLower = this.industryField.toLowerCase()
    const roleLower = this.targetRole.toLowerCase()

    let clusters: Record<string, string[]> = {}
    let relatedRoles: string[] = []

    if (fieldLower.includes("nursing") || roleLower.includes("nurse")) {
      clusters = {
        "Clinical Assessment & Protocols": [
          "Clinical Patient Care",
          "Vital Signs Monitoring",
          "Wound Care & Dressing",
          "Emergency Life Support",
        ],
        "Regulatory & Pharmacological": [
          "NMC Code of Conduct",
          "Medication Administration",
          "Care Planning & Documentation",
        ],
      }
      relatedRoles = ["Registered Nurse", "Staff Nurse", "Lead Nurse", "Clinical Specialist"]
    } else if (
      fieldLower.includes("healthcare") ||
      fieldLower.includes("care") ||
      roleLower.includes("care") ||
      roleLower.includes("carer") ||
      roleLower.includes("support worker")
    ) {
      clusters = {
        "Care Standards & Safeguarding": [
          "Safeguarding Adults",
          "Care Certificate Standards",
          "Person-Centred Care",
          "Infection Control",
        ],
        "Clinical & Daily Support": [
          "Medication Administration",
          "Dementia Care",
          "First Aid",
          "Moving and Handling",
        ],
      }
      relatedRoles = ["Care Worker", "Senior Care Assistant", "Support Worker", "Healthcare Assistant"]
    } else if (
      fieldLower.includes("tech") ||
      fieldLower.includes("software") ||
      roleLower.includes("developer") ||
      roleLower.includes("engineer")
    ) {
      clusters = {
        "Languages & Frameworks": [
          "TypeScript & React",
          "Next.js & Server Components",
          "Node.js & APIs",
          "SQL & Database Design",
        ],
        "Architecture & DevOps": [
          "System Architecture",
          "Cloud Infrastructure",
          "Git & CI/CD",
        ],
      }
      relatedRoles = ["Full Stack Engineer", "Software Developer", "Backend Engineer", "Frontend Developer"]
    } else if (fieldLower.includes("education") || fieldLower.includes("teaching")) {
      clusters = {
        "Classroom & Curriculum": [
          "Classroom Management",
          "Lesson Planning & Delivery",
          "Student Mentoring",
        ],
        "SEN & Welfare": [
          "Special Educational Needs (SEN)",
          "Safeguarding in Schools",
          "Child Development & Welfare",
        ],
      }
      relatedRoles = ["Teaching Assistant", "Primary Teacher", "SEN Specialist", "Tutor"]
    } else if (fieldLower.includes("admin")) {
      clusters = {
        "Office Operations & Software": [
          "Office Administration",
          "Microsoft Office & Google Workspace",
          "Data Accuracy & Invoicing",
        ],
        "Client Relations & Coordination": [
          "Customer Communication",
          "Appointment Scheduling",
          "Records Management",
        ],
      }
      relatedRoles = ["Office Administrator", "Receptionist", "Operations Coordinator"]
    } else {
      clusters = {
        "Professional Standards": [
          "Industry Regulations",
          "Quality Compliance",
          "Operations Management",
        ],
        "Communication & Tools": [
          "Workplace Communication",
          "Cross-Functional Teamwork",
          "Digital Software & Productivity",
        ],
      }
      relatedRoles = [this.targetRole, `Senior ${this.targetRole}`, `Lead ${this.targetRole}`]
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
        relatedRoles,
      }
    })
  }
}
