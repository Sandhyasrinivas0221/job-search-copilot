/**
 * Learning Planner Agent - Universal Gap Closer & Interview Prep
 *
 * Sealed Abilities: Cannot apply to jobs, cannot change statuses
 *
 * Responsibilities:
 * - Detects user's profession (Healthcare & Social Care, Nursing, Tech, Education, Admin, Logistics, etc.)
 * - Provides accredited, free learning resources and curriculum for their exact profession
 * - Produces realistic interview preparation packs and model answers tailored to their industry
 */

import { LearningPlanItem, InterviewPrepPack, Application, ApplicationStatus, User } from "../types"
import { getTrendingSkills, createLearningTask, getApplicationsByStatus, getUser } from "../lib/db"

export class LearningPlannerAgent {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Main entry point - generate learning plans based on user's field and market demands
   */
  async generateWeeklyLearningPlan(): Promise<LearningPlanItem[]> {
    console.log(`[LearningPlannerAgent] Generating learning plan for user ${this.userId}`)

    // Get user career profile
    const user = await getUser(this.userId)
    let parsedBio: any = {}
    if (user?.bio) {
      try {
        parsedBio = JSON.parse(user.bio)
      } catch {
        parsedBio = {}
      }
    }

    const targetRole = parsedBio.target_role || "Professional"
    const industryField = parsedBio.industry_field || "General Professional"

    const planItems: LearningPlanItem[] = []

    const fieldLower = industryField.toLowerCase()
    const roleLower = targetRole.toLowerCase()

    if (fieldLower.includes("nursing") || roleLower.includes("nurse")) {
      planItems.push(...(await this.generateNursingPlan()))
    } else if (
      fieldLower.includes("healthcare") ||
      fieldLower.includes("care") ||
      roleLower.includes("care") ||
      roleLower.includes("carer") ||
      roleLower.includes("support worker")
    ) {
      planItems.push(...(await this.generateHealthAndCarePlan(targetRole)))
    } else if (
      fieldLower.includes("tech") ||
      fieldLower.includes("software") ||
      roleLower.includes("developer") ||
      roleLower.includes("engineer")
    ) {
      planItems.push(...(await this.generateTechPlan()))
    } else if (
      fieldLower.includes("education") ||
      fieldLower.includes("teaching") ||
      roleLower.includes("teacher") ||
      roleLower.includes("tutor")
    ) {
      planItems.push(...(await this.generateEducationPlan()))
    } else if (
      fieldLower.includes("admin") ||
      roleLower.includes("administrator") ||
      roleLower.includes("receptionist")
    ) {
      planItems.push(...(await this.generateAdminPlan()))
    } else if (
      fieldLower.includes("logistics") ||
      fieldLower.includes("driving") ||
      roleLower.includes("driver") ||
      roleLower.includes("warehouse")
    ) {
      planItems.push(...(await this.generateLogisticsPlan()))
    } else {
      planItems.push(...(await this.generateGeneralIndustryPlan(targetRole, industryField)))
    }

    // Interview prep pack
    const rejectedApplications = await getApplicationsByStatus(
      this.userId,
      ApplicationStatus.REJECTED
    )
    const prepPacks = await this.createInterviewPrepPacks(targetRole, rejectedApplications, industryField)

    for (const prep of prepPacks) {
      planItems.push({
        topic: `Interview Prep: ${prep.role}`,
        tasks: [],
        estimatedHours: 4,
        resources: prep.studyResources,
        priority: "HIGH",
      })
    }

    return planItems
  }

  /**
   * Generates UK Care Worker and Social Care learning curricula
   */
  private async generateHealthAndCarePlan(role: string): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: "The Care Certificate Standards (UK)",
        hours: 6,
        description:
          "Master the 15 fundamental standards of health and social care required by CQC and SSSC, covering duty of care, equality, and person-centred care.",
        resources: [
          "Skills for Care - The Care Certificate Standards: https://www.skillsforcare.org.uk/Developing-your-workforce/Care-Certificate/The-Care-Certificate.aspx",
          "OpenLearn (Open University) - Introducing Social Care: https://www.open.edu/openlearn/health-sports-psychology/health/introducing-social-care/content-section-0",
        ],
      },
      {
        skill: "Safeguarding Adults & Vulnerable People",
        hours: 4,
        description:
          "Recognize indicators of harm, abuse, and neglect. Understand mandatory reporting procedures, the Care Act 2014, and adult protection policies.",
        resources: [
          "Social Care Institute for Excellence (SCIE) - Safeguarding Adults: https://www.scie.org.uk/safeguarding/adults",
          "NHS e-Learning for Healthcare - Safeguarding Adults Level 2: https://www.e-lfh.org.uk/programmes/safeguarding-adults/",
        ],
      },
      {
        skill: "Safe Medication Administration (MAR)",
        hours: 5,
        description:
          "Understand 6 Rights of Medication Administration, MAR chart auditing, safe storage, and reporting administration discrepancies or resident refusal.",
        resources: [
          "NICE Guidelines - Managing medicines in care homes: https://www.nice.org.uk/guidance/sc1",
          "Skills for Care - Medication Management: https://www.skillsforcare.org.uk/Developing-your-workforce/Care-topics/Medication/Medication.aspx",
        ],
      },
      {
        skill: "Dementia Awareness & Person-Centred Support",
        hours: 4,
        description:
          "Techniques for communication, validation therapy, environmental adaptation, and maintaining dignity in individuals living with Alzheimer's and vascular dementia.",
        resources: [
          "Alzheimer's Society - Training and Resources: https://www.alzheimers.org.uk/",
          "SCIE - Dementia Gateway: https://www.scie.org.uk/dementia/",
        ],
      },
    ]

    return this.createTasksFromModules(modules, "Healthcare & Social Care")
  }

  /**
   * Generates Nursing & Clinical Healthcare learning curricula
   */
  private async generateNursingPlan(): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: "NMC Code of Conduct & Clinical Revalidation",
        hours: 5,
        description:
          "Prioritise people, practice effectively, preserve safety, and promote professionalism and trust under the Nursing and Midwifery Council guidelines.",
        resources: [
          "NMC UK - The Code: https://www.nmc.org.uk/standards/code/",
          "Royal College of Nursing (RCN) Learning Portal: https://www.rcn.org.uk/professional-development",
        ],
      },
      {
        skill: "Clinical Triage & Patient Observations (NEWS2)",
        hours: 4,
        description:
          "Systematic recording and escalation using the National Early Warning Score 2 (NEWS2) for deteriorating patients.",
        resources: [
          "Royal College of Physicians - NEWS2 Resources: https://www.rcplondon.ac.uk/projects/outputs/national-early-warning-score-news-2",
        ],
      },
      {
        skill: "Aseptic Non-Touch Technique (ANTT) & Wound Care",
        hours: 4,
        description:
          "Standardized aseptic procedures, dressing selection, infection prevention, and chronic wound healing pathways.",
        resources: [
          "The-ANTT-Approach: https://www.antt.org/",
        ],
      },
    ]

    return this.createTasksFromModules(modules, "Nursing & Clinical Healthcare")
  }

  /**
   * Generates Technology & Software Engineering learning curricula
   */
  private async generateTechPlan(): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: "Full Stack Architecture & Next.js Patterns",
        hours: 6,
        description:
          "Server Components, Server Actions, streaming SSR, API routing, and state orchestration in enterprise web platforms.",
        resources: [
          "Next.js Official Documentation: https://nextjs.org/docs",
          "web.dev - Web Performance Architecture: https://web.dev/",
        ],
      },
      {
        skill: "Distributed Systems & Database Query Optimization",
        hours: 5,
        description:
          "PostgreSQL indexing, connection pooling, transactions, caching layers, and asynchronous background worker queues.",
        resources: [
          "Use The Index, Luke! - SQL Indexing Guide: https://use-the-index-luke.com/",
        ],
      },
      {
        skill: "System Design & Scalability Interviews",
        hours: 5,
        description:
          "Designing high-availability systems, rate limiters, microservices decomposition, and trade-off analysis under high traffic.",
        resources: [
          "System Design Primer - GitHub: https://github.com/donnemartin/system-design-primer",
        ],
      },
    ]

    return this.createTasksFromModules(modules, "Technology & Software Engineering")
  }

  /**
   * Generates Education & Teaching curricula
   */
  private async generateEducationPlan(): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: "Special Educational Needs and Disabilities (SEND) Support",
        hours: 5,
        description:
          "Understanding autism spectrum conditions, ADHD strategies, dyslexia support, and EHCP (Education, Health and Care Plan) delivery.",
        resources: [
          "Council for Disabled Children - SEND Training: https://councilfordisabledchildren.org.uk/",
          "National Autistic Society - Education Resources: https://www.autism.org.uk/",
        ],
      },
      {
        skill: "Safeguarding in Schools (Keeping Children Safe in Education)",
        hours: 4,
        description:
          "Statutory guidance for schools and colleges on safeguarding children and safer working practice.",
        resources: [
          "GOV.UK - Keeping children safe in education (KCSIE): https://www.gov.uk/government/publications/keeping-children-safe-in-education--2",
        ],
      },
    ]

    return this.createTasksFromModules(modules, "Education & Teaching")
  }

  /**
   * Generates Administration & Office Support curricula
   */
  private async generateAdminPlan(): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: "Advanced Document Automation & Spreadsheet Analysis",
        hours: 4,
        description:
          "Mastering data lookups, pivot reporting, document templating, and automated scheduling workflows in Excel and Google Sheets.",
        resources: [
          "GCF LearnFree - Excel & Office Tutorials: https://edu.gcfglobal.org/en/excel/",
        ],
      },
      {
        skill: "Data Protection, GDPR & Confidential Record Keeping",
        hours: 3,
        description:
          "Compliance with UK GDPR, secure document handling, retention policies, and data subject access requests.",
        resources: [
          "Information Commissioner's Office (ICO) Guidance: https://ico.org.uk/for-organisations/",
        ],
      },
    ]

    return this.createTasksFromModules(modules, "Administration & Customer Service")
  }

  /**
   * Generates Logistics & Driving curricula
   */
  private async generateLogisticsPlan(): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: "Health & Safety, Manual Handling & COSHH in Warehousing",
        hours: 4,
        description:
          "Ergonomic lifting techniques, hazardous substances handling, and warehouse safety regulations under HSE guidance.",
        resources: [
          "Health and Safety Executive (HSE) - Warehousing: https://www.hse.gov.uk/logistics/",
        ],
      },
    ]

    return this.createTasksFromModules(modules, "Logistics & Driving")
  }

  /**
   * Universal learning plan for any other profession
   */
  private async generateGeneralIndustryPlan(
    role: string,
    industry: string
  ): Promise<LearningPlanItem[]> {
    const modules = [
      {
        skill: `Core Professional Standards in ${industry}`,
        hours: 4,
        description: `Industry best practices, compliance, and core responsibilities for a professional ${role}.`,
        resources: [
          `OpenLearn (Free University Courses) - https://www.open.edu/openlearn/`,
          `Coursera Free Career Foundations - https://www.coursera.org/`,
        ],
      },
      {
        skill: "Workplace Communication & Stakeholder Management",
        hours: 3,
        description: "Effective communication, conflict resolution, and cross-functional team coordination.",
        resources: [
          "Harvard Business Review - Effective Workplace Communication: https://hbr.org/",
          "Alison - Professional Communication Skills: https://alison.com/",
        ],
      },
    ]

    return this.createTasksFromModules(modules, industry)
  }

  private async createTasksFromModules(
    modules: { skill: string; hours: number; description: string; resources: string[] }[],
    topic: string
  ): Promise<LearningPlanItem[]> {
    const items: LearningPlanItem[] = []

    for (const mod of modules) {
      const task = await createLearningTask({
        user_id: this.userId,
        application_id: null,
        title: `Module: ${mod.skill}`,
        description: mod.description,
        topic: topic,
        difficulty_level: "INTERMEDIATE",
        estimated_hours: mod.hours,
        resources: mod.resources,
        notes: `Targeted to accelerate placement and qualification.`,
        completed_at: null,
        priority: "MEDIUM",
        completed: false,
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      })

      items.push({
        topic: mod.skill,
        tasks: task ? [task] : [],
        estimatedHours: mod.hours,
        resources: mod.resources,
        priority: "HIGH",
      })
    }

    return items
  }

  /**
   * Creates realistic, industry-specific interview preparation packs
   */
  private async createInterviewPrepPacks(
    role: string,
    rejections: Application[],
    industryField: string
  ): Promise<InterviewPrepPack[]> {
    const fieldLower = industryField.toLowerCase()
    const roleLower = role.toLowerCase()

    let questions: string[] = []
    let modelAnswers: Record<string, string> = {}
    let studyResources: string[] = []

    if (fieldLower.includes("care") || roleLower.includes("care")) {
      questions = [
        "How do you handle a resident who refuses their prescribed medication or personal care?",
        "Can you describe an instance where you identified and reported a safeguarding concern?",
        "How do you maintain person-centred care, dignity, and privacy during personal care assistance?",
      ]
      modelAnswers = {
        "Handling medication refusal":
          "I remain calm, listen attentively, never force the resident, explain the benefit gently, check for any discomfort, document the refusal on the MAR chart, and inform the senior nurse/team leader.",
        "Safeguarding reporting":
          "My priority is the immediate safety of the individual. I document factual observations without delay, maintain strict confidentiality, and report directly to the designated safeguarding lead in accordance with our duty of care.",
      }
      studyResources = [
        "Skills for Care - Interview Advice: https://www.skillsforcare.org.uk/",
      ]
    } else if (fieldLower.includes("tech") || roleLower.includes("developer") || roleLower.includes("engineer")) {
      questions = [
        "Walk me through how you design and structure a high-performance REST/GraphQL API.",
        "How do you handle database query bottlenecks and caching in a distributed system?",
        "Describe a critical production bug you investigated and how you resolved it without downtime.",
      ]
      modelAnswers = {
        "Database bottleneck":
          "I inspect slow query logs with EXPLAIN ANALYZE, evaluate missing compound indexes, add Redis caching for read-heavy hot paths, and consider read replicas or connection pooling.",
      }
      studyResources = [
        "Tech Interview Handbook: https://www.techinterviewhandbook.org/",
      ]
    } else {
      questions = [
        "Why are you interested in this role and our organisation?",
        "Can you describe a challenging situation with a stakeholder or customer and how you resolved it?",
        "How do you prioritize multiple competing demands during a busy shift or workday?",
      ]
      modelAnswers = {
        "Prioritizing demands":
          "I assess urgent vs important tasks, communicate clearly with supervisors and colleagues, and maintain a structured checklist while remaining flexible to emergencies.",
      }
      studyResources = [
        "National Careers Service - Interview Advice: https://nationalcareers.service.gov.uk/careers-advice/interview-advice",
      ]
    }

    const pack: InterviewPrepPack = {
      role: role,
      company: rejections[0]?.company_name || "Target Employer",
      expectedQuestions: questions,
      modelAnswers: modelAnswers,
      studyResources: studyResources,
      practiceProblems: [
        "Scenario Practice: Person-centred communication under pressure",
        "Scenario Practice: Accurate incident report writing",
      ],
    }

    return [pack]
  }
}
