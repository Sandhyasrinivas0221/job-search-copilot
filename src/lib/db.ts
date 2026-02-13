import { supabaseAdmin } from "./supabase"
import {
  User,
  Application,
  StatusHistory,
  JobSuggestion,
  SkillDemand,
  LearningTask,
  ApplicationStatus,
} from "@/types"

/**
 * Database utility functions for CRUD operations
 * All operations use the service role client for server-side access
 */

// ============= USER OPERATIONS =============

export async function getUser(userId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single()

  if (error) {
    console.error("Error fetching user:", error)
    return null
  }
  return data
}

export async function createUser(user: Omit<User, "created_at" | "updated_at">): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert([user])
    .select()
    .single()

  if (error) {
    console.error("Error creating user:", error)
    return null
  }
  return data
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single()

  if (error) {
    console.error("Error updating user:", error)
    return null
  }
  return data
}

// ============= APPLICATION OPERATIONS =============

export async function getApplications(userId: string): Promise<Application[]> {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching applications:", error)
    return []
  }
  return data || []
}

export async function getApplication(applicationId: string): Promise<Application | null> {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single()

  if (error) {
    console.error("Error fetching application:", error)
    return null
  }
  return data
}

export async function createApplication(app: Omit<Application, "id" | "created_at" | "updated_at">): Promise<Application | null> {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .insert([app])
    .select()
    .single()

  if (error) {
    console.error("Error creating application:", error)
    return null
  }
  return data
}

export async function updateApplication(applicationId: string, updates: Partial<Application>): Promise<Application | null> {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .update(updates)
    .eq("id", applicationId)
    .select()
    .single()

  if (error) {
    console.error("Error updating application:", error)
    return null
  }
  return data
}

export async function getApplicationsByStatus(userId: string, status: ApplicationStatus): Promise<Application[]> {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .eq("current_status", status)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching applications by status:", error)
    return []
  }
  return data || []
}

// ============= STATUS HISTORY OPERATIONS =============

export async function getStatusHistory(applicationId: string): Promise<StatusHistory[]> {
  const { data, error } = await supabaseAdmin
    .from("status_history")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching status history:", error)
    return []
  }
  return data || []
}

export async function createStatusHistory(entry: Omit<StatusHistory, "id" | "created_at">): Promise<StatusHistory | null> {
  const { data, error } = await supabaseAdmin
    .from("status_history")
    .insert([entry])
    .select()
    .single()

  if (error) {
    console.error("Error creating status history entry:", error)
    return null
  }
  return data
}

// ============= JOB SUGGESTION OPERATIONS =============

export async function getJobSuggestions(userId: string, notApplied = true, notDismissed = true): Promise<JobSuggestion[]> {
  let query = supabaseAdmin
    .from("job_suggestions")
    .select("*")
    .eq("user_id", userId)

  if (notApplied) query = query.eq("applied", false)
  if (notDismissed) query = query.eq("dismissed", false)

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching job suggestions:", error)
    return []
  }
  return data || []
}

export async function createJobSuggestion(job: Omit<JobSuggestion, "id" | "created_at" | "updated_at">): Promise<JobSuggestion | null> {
  const { data, error } = await supabaseAdmin
    .from("job_suggestions")
    .insert([job])
    .select()
    .single()

  if (error) {
    console.error("Error creating job suggestion:", error)
    return null
  }
  return data
}

export async function updateJobSuggestion(jobId: string, updates: Partial<JobSuggestion>): Promise<JobSuggestion | null> {
  const { data, error } = await supabaseAdmin
    .from("job_suggestions")
    .update(updates)
    .eq("id", jobId)
    .select()
    .single()

  if (error) {
    console.error("Error updating job suggestion:", error)
    return null
  }
  return data
}

// ============= SKILL DEMAND OPERATIONS =============

export async function getSkillDemands(userId: string): Promise<SkillDemand[]> {
  const { data, error } = await supabaseAdmin
    .from("skill_demand")
    .select("*")
    .eq("user_id", userId)
    .order("frequency", { ascending: false })

  if (error) {
    console.error("Error fetching skill demands:", error)
    return []
  }
  return data || []
}

export async function getTrendingSkills(userId: string): Promise<SkillDemand[]> {
  const { data, error } = await supabaseAdmin
    .from("skill_demand")
    .select("*")
    .eq("user_id", userId)
    .eq("rising_trend", true)
    .order("frequency", { ascending: false })

  if (error) {
    console.error("Error fetching trending skills:", error)
    return []
  }
  return data || []
}

export async function createOrUpdateSkillDemand(userId: string, skillName: string, updates: Partial<SkillDemand>): Promise<SkillDemand | null> {
  // First try to find existing skill
  const { data: existing } = await supabaseAdmin
    .from("skill_demand")
    .select("*")
    .eq("user_id", userId)
    .eq("skill_name", skillName)
    .single()

  if (existing) {
    // Update existing
    const { data, error } = await supabaseAdmin
      .from("skill_demand")
      .update({ ...updates, last_detected: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating skill demand:", error)
      return null
    }
    return data
  } else {
    // Create new
    const { data, error } = await supabaseAdmin
      .from("skill_demand")
      .insert([
        {
          user_id: userId,
          skill_name: skillName,
          ...updates,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating skill demand:", error)
      return null
    }
    return data
  }
}

// ============= LEARNING TASK OPERATIONS =============

export async function getLearningTasks(userId: string, completedOnly = false): Promise<LearningTask[]> {
  let query = supabaseAdmin
    .from("learning_tasks")
    .select("*")
    .eq("user_id", userId)

  if (completedOnly) {
    query = query.eq("completed", true)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching learning tasks:", error)
    return []
  }
  return data || []
}

export async function createLearningTask(task: Omit<LearningTask, "id" | "created_at" | "updated_at">): Promise<LearningTask | null> {
  const { data, error } = await supabaseAdmin
    .from("learning_tasks")
    .insert([task])
    .select()
    .single()

  if (error) {
    console.error("Error creating learning task:", error)
    return null
  }
  return data
}

export async function updateLearningTask(taskId: string, updates: Partial<LearningTask>): Promise<LearningTask | null> {
  const { data, error } = await supabaseAdmin
    .from("learning_tasks")
    .update(updates)
    .eq("id", taskId)
    .select()
    .single()

  if (error) {
    console.error("Error updating learning task:", error)
    return null
  }
  return data
}

export async function completeLearningTask(taskId: string): Promise<LearningTask | null> {
  return updateLearningTask(taskId, {
    completed: true,
    completed_at: new Date().toISOString() as any,
  })
}
