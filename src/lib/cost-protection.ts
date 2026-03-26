/**
 * Cost Protection Layer
 * Prevents cost explosion from unmetered API calls
 */

import { supabaseAdmin } from "./supabase"

export interface CostTracker {
  userId: string
  date: string // YYYY-MM-DD
  gmailApiCalls: number
  emailsSent: number
  databaseQueries: number
  totalCost: number
}

const COST_PER_1000_GMAIL_CALLS = 0.0 // Gmail is free tier
const COST_PER_EMAIL = 0.0005 // Resend: $0.0005 per email
const COST_WARNING_THRESHOLD = 10 // Daily cost warning threshold ($10)
const COST_DAILY_BUDGET = 100 // Daily budget limit ($100)

/**
 * Track API call costs
 */
export async function trackCost(
  userId: string,
  costType: "gmail" | "email" | "database",
  amount: number = 1
): Promise<void> {
  const today = new Date().toISOString().split("T")[0]

  try {
    const { data: existing } = await supabaseAdmin
      .from("cost_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single()

    if (existing) {
      const updates: Record<string, any> = {}
      let costIncrease = 0

      if (costType === "gmail") {
        updates.gmailApiCalls = existing.gmailApiCalls + amount
        costIncrease = (amount * COST_PER_1000_GMAIL_CALLS) / 1000
      } else if (costType === "email") {
        updates.emailsSent = existing.emailsSent + amount
        costIncrease = amount * COST_PER_EMAIL
      } else if (costType === "database") {
        updates.databaseQueries = existing.databaseQueries + amount
      }

      updates.totalCost = existing.totalCost + costIncrease

      await supabaseAdmin
        .from("cost_tracking")
        .update(updates)
        .eq("user_id", userId)
        .eq("date", today)
    } else {
      const record: any = {
        user_id: userId,
        date: today,
        gmailApiCalls: costType === "gmail" ? amount : 0,
        emailsSent: costType === "email" ? amount : 0,
        databaseQueries: costType === "database" ? amount : 0,
      }

      let costIncrease = 0
      if (costType === "gmail") {
        costIncrease = (amount * COST_PER_1000_GMAIL_CALLS) / 1000
      } else if (costType === "email") {
        costIncrease = amount * COST_PER_EMAIL
      }

      record.totalCost = costIncrease

      await supabaseAdmin.from("cost_tracking").insert([record])
    }
  } catch (error) {
    console.error("[cost-protection] Error tracking cost:", error)
  }
}

/**
 * Check if user has exceeded cost limits
 */
export async function checkCostLimits(userId: string): Promise<{ canProceed: boolean; reason?: string }> {
  const today = new Date().toISOString().split("T")[0]

  try {
    const { data: tracker } = await supabaseAdmin
      .from("cost_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single()

    if (!tracker) return { canProceed: true }

    if (tracker.totalCost > COST_DAILY_BUDGET) {
      return {
        canProceed: false,
        reason: `Daily cost budget ($${COST_DAILY_BUDGET}) exceeded. Current: $${tracker.totalCost.toFixed(2)}`,
      }
    }

    if (tracker.totalCost > COST_WARNING_THRESHOLD) {
      console.warn(
        `[cost-protection] User ${userId} approaching daily cost threshold: $${tracker.totalCost.toFixed(2)}`
      )
    }

    return { canProceed: true }
  } catch (error) {
    console.error("[cost-protection] Error checking cost limits:", error)
    return { canProceed: true } // Fail open - don't break functionality
  }
}

/**
 * Batch Gmail API calls to reduce costs and respect quotas
 */
export async function batchGmailCalls(
  userIds: string[],
  callsPerUser: number = 15
): Promise<void> {
  const delays = [
    1000, 2000, 3000, 5000, 8000, 13000, 21000,
  ] // Exponential backoff

  for (let i = 0; i < userIds.length; i++) {
    if (i > 0) {
      const delay = delays[Math.min(i - 1, delays.length - 1)]
      console.log(`[cost-protection] Waiting ${delay}ms before processing next user...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    const userId = userIds[i]
    const costCheck = await checkCostLimits(userId)
    if (!costCheck.canProceed) {
      console.warn(`[cost-protection] Skipping user ${userId}: ${costCheck.reason}`)
    }
  }
}

/**
 * Get cost report for user
 */
export async function getCostReport(
  userId: string,
  days: number = 7
): Promise<{ totalCost: number; byDay: Record<string, number> }> {
  const today = new Date()
  const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  const startDateStr = startDate.toISOString().split("T")[0]

  try {
    const { data: records } = await supabaseAdmin
      .from("cost_tracking")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDateStr)

    if (!records) return { totalCost: 0, byDay: {} }

    const byDay: Record<string, number> = {}
    let totalCost = 0

    for (const record of records) {
      byDay[record.date] = record.totalCost
      totalCost += record.totalCost
    }

    return { totalCost, byDay }
  } catch (error) {
    console.error("[cost-protection] Error getting cost report:", error)
    return { totalCost: 0, byDay: {} }
  }
}
