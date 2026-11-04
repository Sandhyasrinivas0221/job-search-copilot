import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Universal Skill and Role Dictionary across different industries
 */
const INDUSTRY_RULES = [
  {
    field: "Healthcare & Social Care",
    keywords: [
      "care worker", "care assistant", "support worker", "healthcare assistant",
      "hca", "care home", "domiciliary", "residential care", "social care",
      "dementia", "safeguarding", "medication", "moving and handling",
      "patient care", "nursing home", "carer", "vulnerable adults",
      "palliative care", "nvq", "svq", "care certificate", "sssc", "cqc"
    ],
    defaultRole: "Care Worker",
    skills: [
      "Dementia Care",
      "Safeguarding Adults & Children",
      "Medication Administration",
      "Moving and Handling",
      "Infection Prevention & Control",
      "Person-Centred Care",
      "First Aid & Basic Life Support",
      "Health and Social Care Standards",
    ],
  },
  {
    field: "Nursing & Clinical Healthcare",
    keywords: [
      "registered nurse", "staff nurse", "rgn", "rmn", "clinical",
      "ward", "hospital", "phlebotomy", "wound care", "triage",
      "nmc", "nhs", "catheterisation", "cannulation"
    ],
    defaultRole: "Registered Nurse",
    skills: [
      "Clinical Patient Care",
      "NMC Code of Conduct",
      "Medication & IV Administration",
      "Wound Care & Dressing",
      "Vital Signs & Patient Monitoring",
      "Care Planning & Documentation",
      "Emergency Life Support",
    ],
  },
  {
    field: "Education & Teaching",
    keywords: [
      "teacher", "teaching assistant", "ta", "sen", "tutor",
      "classroom", "curriculum", "early years", "eyfs", "school",
      "safeguarding children", "lesson plan", "qts", "dbs"
    ],
    defaultRole: "Teaching Assistant",
    skills: [
      "Classroom Management",
      "Special Educational Needs (SEN)",
      "Safeguarding in Schools",
      "Lesson Planning & Delivery",
      "Child Development & Welfare",
      "Student Mentoring",
    ],
  },
  {
    field: "Administration & Customer Service",
    keywords: [
      "administrator", "receptionist", "customer service", "office assistant",
      "data entry", "scheduling", "invoicing", "client support", "crm"
    ],
    defaultRole: "Administrative Assistant",
    skills: [
      "Office Administration",
      "Customer Communication",
      "Appointment Scheduling",
      "Microsoft Office & Google Workspace",
      "Records Management",
      "Data Accuracy & Invoicing",
    ],
  },
  {
    field: "Logistics, Warehousing & Driving",
    keywords: [
      "driver", "delivery", "courier", "warehouse", "forklift",
      "hgv", "van driver", "picker", "packer", "logistics", "supply chain"
    ],
    defaultRole: "Delivery Driver / Warehouse Operative",
    skills: [
      "Route Navigation & Delivery",
      "Health & Safety Regulations",
      "Inventory & Order Picking",
      "Vehicle Maintenance Checks",
      "Manual Handling",
    ],
  },
  {
    field: "Technology & Software Engineering",
    keywords: [
      "software engineer", "developer", "frontend", "backend", "full stack",
      "react", "node", "python", "java", "sql", "aws", "cloud", "api", "git"
    ],
    defaultRole: "Software Engineer",
    skills: [
      "Full Stack Development",
      "API Design & Integration",
      "Database Management (SQL/NoSQL)",
      "Cloud & DevOps Deployment",
      "Code Review & Testing",
    ],
  },
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get("userId") as string
    const file = formData.get("file") as File | null
    const textInput = formData.get("text") as string | null

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    let resumeText = ""

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const filename = file.name.toLowerCase()

      if (filename.endsWith(".pdf")) {
        try {
          // @ts-ignore
          const pdfModule: any = await import("pdf-parse")
          const PDFParserClass = pdfModule.PDFParse || pdfModule.default || pdfModule
          if (typeof PDFParserClass === "function") {
            try {
              const parser = new PDFParserClass({ data: buffer })
              const result = await parser.getText()
              resumeText = typeof result === "string" ? result : result?.text || ""
              if (typeof parser.destroy === "function") await parser.destroy()
            } catch {
              const direct = await (PDFParserClass as any)(buffer)
              resumeText = direct?.text || ""
            }
          }
        } catch (pdfErr) {
          console.error("[resume-upload] PDF parse error, falling back to string:", pdfErr)
          resumeText = buffer.toString("utf-8")
        }
      } else {
        // Plain text, markdown, docx plain text
        resumeText = buffer.toString("utf-8")
      }
    } else if (textInput) {
      resumeText = textInput
    }

    if (!resumeText || resumeText.trim().length < 20) {
      return NextResponse.json(
        { error: "Resume content is empty or could not be read." },
        { status: 400 }
      )
    }

    console.log(`[resume-upload] Parsing resume text (${resumeText.length} characters)...`)

    // Extract Candidate Name (first line or header)
    const lines = resumeText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2)
    const possibleName = lines[0]?.substring(0, 50) || "Job Candidate"

    // Detect Industry Field & Matching Skills
    const lowerText = resumeText.toLowerCase()
    let bestMatch = INDUSTRY_RULES[0] // Default to Healthcare & Social Care
    let highestScore = 0

    for (const ind of INDUSTRY_RULES) {
      let score = 0
      for (const kw of ind.keywords) {
        if (lowerText.includes(kw)) {
          score += 1
        }
      }
      if (score > highestScore) {
        highestScore = score
        bestMatch = ind
      }
    }

    // Detect Target Role from text or default from matched industry
    let detectedRole = bestMatch.defaultRole
    for (const kw of bestMatch.keywords.slice(0, 8)) {
      if (lowerText.includes(kw)) {
        // Capitalize words
        detectedRole = kw
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
        break
      }
    }

    // Detect Location (UK, Scotland, Cities)
    let detectedLocation = "United Kingdom"
    if (/scotland|edinburgh|glasgow|fife|dundee|aberdeen/i.test(lowerText)) {
      detectedLocation = "Scotland, United Kingdom"
    } else if (/london|manchester|birmingham|leeds|bristol/i.test(lowerText)) {
      detectedLocation = "United Kingdom"
    }

    // Extract skills present in text + matched default skills
    const extractedSkills = new Set<string>(bestMatch.skills)
    for (const rule of INDUSTRY_RULES) {
      for (const sk of rule.skills) {
        if (lowerText.includes(sk.toLowerCase())) {
          extractedSkills.add(sk)
        }
      }
    }

    const finalSkills = Array.from(extractedSkills).slice(0, 12)

    // Save profile to Supabase
    const bioPayload = JSON.stringify({
      target_role: detectedRole,
      target_location: detectedLocation,
      industry_field: bestMatch.field,
      institution_name: null,
      resume_summary: resumeText.substring(0, 3000),
    })

    await supabaseAdmin
      .from("users")
      .update({
        full_name: possibleName,
        bio: bioPayload,
        skills: finalSkills,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    console.log(
      `[resume-upload] Successfully parsed resume: Role: "${detectedRole}", Field: "${bestMatch.field}", Location: "${detectedLocation}", Skills: ${finalSkills.length}`
    )

    return NextResponse.json({
      success: true,
      message: "Resume parsed and profile updated successfully!",
      extracted: {
        candidate_name: possibleName,
        target_role: detectedRole,
        industry_field: bestMatch.field,
        target_location: detectedLocation,
        skills: finalSkills,
      },
    })
  } catch (error) {
    console.error("[resume-upload] Error parsing resume:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
