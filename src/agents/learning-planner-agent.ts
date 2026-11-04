/**
 * Learning Planner Agent - Universal Gap Closer & Interview Prep
 *
 * Sealed Abilities: Cannot apply to jobs, cannot change statuses
 *
 * Responsibilities:
 * - Detect user's profession (Healthcare & Social Care, Nursing, Business, Tech, Education, etc.)
 * - Provide accredited, free learning resources and courses for their exact profession
 * - Produce realistic interview preparation packs and model answers tailored to their industry
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

    const targetRole = parsedBio.target_role || "Care Worker"
    const industryField = parsedBio.industry_field || "Healthcare & Social Care"
    const isCareOrHealth =
      /care|nurse|health|support worker|carer|social care/i.test(targetRole) ||
      /healthcare/i.test(industryField)

    const planItems: LearningPlanItem[] = []

    if (isCareOrHealth) {
      planItems.push(...(await this.generateHealthAndCarePlan(targetRole)))
    } else {
      planItems.push(...(await this.generateGeneralIndustryPlan(targetRole, industryField)))
    }

    // Interview prep pack
    const rejectedApplications = await getApplicationsByStatus(
      this.userId,
      ApplicationStatus.REJECTED
    )
    const prepPacks = await this.createInterviewPrepPacks(targetRole, rejectedApplications, isCareOrHealth)

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
   * Generates UK Care Worker, Healthcare, and Nursing learning curricula
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
          "Practical guidance on storing, recording, administering, and disposing of medications. Understand MAR charts, dosage checks, and error prevention.",
        resources: [
          "NICE Guidelines - Managing Medicines in Care Homes: https://www.nice.org.uk/guidance/sc1",
          "OpenLearn - Understanding Medicines: https://www.open.edu/openlearn/health-sports-psychology/understanding-medicines/content-section-0",
        ],
      },
      {
        skill: "Dementia Awareness & Person-Centred Care",
        hours: 4,
        description:
          "Learn compassionate communication techniques, managing distressed behaviors, and creating a supportive environment for individuals living with dementia.",
        resources: [
          "Alzheimer's Society UK - Dementia Training & Best Practice: https://www.alzheimers.org.uk/dementia-professionals",
          "SCIE - Dementia Care Video Walkthroughs: https://www.scie.org.uk/dementia/",
        ],
      },
      {
        skill: "Moving and Handling / Manual Handling",
        hours: 3,
        description:
          "Safe operation of hoists, slide sheets, standing aids, and mobility equipment according to UK Health & Safety Executive regulations.",
        resources: [
          "HSE UK - Moving and Handling in Health and Social Care: https://www.hse.gov.uk/healthservices/moving-handling.htm",
          "St John Ambulance - Manual Handling Training Guide: https://www.sja.org.uk/courses/workplace-first-aid/manual-handling/",
        ],
      },
    ]

    const items: LearningPlanItem[] = []

    for (const mod of modules) {
      const task = await createLearningTask({
        user_id: this.userId,
        application_id: null,
        title: `Course: ${mod.skill}`,
        description: mod.description,
        topic: "Health and Social Care",
        difficulty_level: "BEGINNER",
        estimated_hours: mod.hours,
        resources: mod.resources,
        notes: `Essential certification topic for ${role} roles across care homes and NHS providers.`,
        completed_at: null,
        priority: "HIGH",
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
      {
        skill: `Technical Tools & Certifications for ${role}`,
        hours: 5,
        description: `Practical software, regulatory certifications, and operational workflows utilized in modern ${role} vacancies.`,
        resources: [
          `Google Career Certificates - https://grow.google/certificates/`,
          `UK Government Skills Toolkit - https://nationalcareers.service.gov.uk/find-a-course/the-skills-toolkit`,
        ],
      },
    ]

    const items: LearningPlanItem[] = []

    for (const mod of modules) {
      const task = await createLearningTask({
        user_id: this.userId,
        application_id: null,
        title: `Module: ${mod.skill}`,
        description: mod.description,
        topic: industry,
        difficulty_level: "INTERMEDIATE",
        estimated_hours: mod.hours,
        resources: mod.resources,
        notes: `Targeted to accelerate placement in ${role} vacancies.`,
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
        priority: "MEDIUM",
      })
    }

    return items
  }

  /**
   * Generates realistic interview prep packs
   */
  private async createInterviewPrepPacks(
    role: string,
    rejections: Application[],
    isCareOrHealth: boolean
  ): Promise<InterviewPrepPack[]> {
    const questions = isCareOrHealth
      ? [
          "How would you handle a resident who is agitated or refusing their scheduled medication?",
          "Can you describe an instance where you identified and reported a safeguarding concern?",
          "How do you maintain person-centred care, dignity, and privacy during personal care assistance?",
          "What would you do if a colleague was not following infection control or safe moving and handling procedures?",
        ]
      : [
          "Why are you interested in this role and our organisation?",
          "Can you describe a challenging situation with a client or team member and how you resolved it?",
          "How do you prioritize multiple competing demands during a busy shift or workday?",
          "What steps do you take to ensure high quality and regulatory compliance in your daily duties?",
        ]

    const modelAnswers: Record<string, string> = isCareOrHealth
      ? {
          "Handling medication refusal":
            "I remain calm, listen attentively, never force the resident, explain the benefit gently, check for any discomfort, document the refusal on the MAR chart, and inform the senior nurse/team leader.",
          "Safeguarding reporting":
            "My priority is the immediate safety of the individual. I document factual observations without delay, maintain strict confidentiality, and report directly to the designated safeguarding lead in accordance with our duty of care.",
          "Dignity in personal care":
            "I explain each step beforehand, close curtains/doors, cover parts of the body not being washed, offer choices (e.g. clothing selection), and encourage them to do as much as they comfortably can to promote independence.",
        }
      : {
          "Prioritizing demands":
            "I assess urgent vs important tasks, communicate clearly with supervisors and colleagues, and maintain a structured checklist while remaining flexible to emergencies.",
        }

    const studyResources = isCareOrHealth
      ? [
          "Care Worker Interview Questions & Answers - NHS & Social Care: https://www.skillsforcare.org.uk/",
          "Social Care Institute for Excellence (SCIE) Practice Guides: https://www.scie.org.uk/",
        ]
      : [
          "National Careers Service - Interview Skills & Practice: https://nationalcareers.service.gov.uk/careers-advice/interview-advice",
        ]

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
