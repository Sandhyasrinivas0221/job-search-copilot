export interface FollowUpInfo {
  daysPassed: number
  followUp7Date: string
  followUp14Date: string
  status: "none" | "upcoming_7d" | "due_7d" | "due_14d"
  label: string
  badgeClass: string
}

/**
 * Calculates 7-day and 14-day follow-up due dates from application date.
 */
export function getFollowUpInfo(
  appliedDateStr: string | null | undefined,
  currentStatus: string
): FollowUpInfo {
  // Terminal or non-actionable statuses don't need follow-up alerts
  if (["REJECTED", "ARCHIVED", "OFFER", "ACCEPTED"].includes(currentStatus)) {
    return {
      daysPassed: 0,
      followUp7Date: "",
      followUp14Date: "",
      status: "none",
      label: "",
      badgeClass: "",
    }
  }

  const baseDate = appliedDateStr ? new Date(appliedDateStr) : new Date()
  if (isNaN(baseDate.getTime())) {
    return {
      daysPassed: 0,
      followUp7Date: "",
      followUp14Date: "",
      status: "none",
      label: "",
      badgeClass: "",
    }
  }

  const now = new Date()
  const diffTime = now.getTime() - baseDate.getTime()
  const daysPassed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))

  const d7 = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000)
  const d14 = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000)

  const formatShort = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" })

  const followUp7Date = formatShort(d7)
  const followUp14Date = formatShort(d14)

  if (daysPassed < 7) {
    const remaining = 7 - daysPassed
    return {
      daysPassed,
      followUp7Date,
      followUp14Date,
      status: "upcoming_7d",
      label: `Follow-up #1 in ${remaining}d (${followUp7Date})`,
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    }
  } else if (daysPassed >= 7 && daysPassed < 14) {
    const remaining14 = 14 - daysPassed
    return {
      daysPassed,
      followUp7Date,
      followUp14Date,
      status: "due_7d",
      label: `🔔 Follow-up #1 DUE • #2 in ${remaining14}d (${followUp14Date})`,
      badgeClass: "bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse",
    }
  } else {
    return {
      daysPassed,
      followUp7Date,
      followUp14Date,
      status: "due_14d",
      label: `⚠️ Follow-up #2 OVERDUE (${daysPassed}d since applied)`,
      badgeClass: "bg-red-50 text-red-800 border-red-300 font-bold",
    }
  }
}
