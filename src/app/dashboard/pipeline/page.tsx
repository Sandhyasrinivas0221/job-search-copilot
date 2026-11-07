"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession, getAuthHeaders } from "@/lib/client-auth"
import { Application, ApplicationStatus } from "@/types"
import { getFollowUpInfo } from "@/lib/follow-up"

const PIPELINE_COLUMNS: { status: ApplicationStatus; title: string; color: string }[] = [
  { status: ApplicationStatus.APPLIED, title: "Applied", color: "border-blue-500 bg-blue-50/40" },
  { status: ApplicationStatus.SCREENING, title: "Screening", color: "border-purple-500 bg-purple-50/40" },
  { status: ApplicationStatus.INTERVIEW, title: "Interview", color: "border-yellow-500 bg-yellow-50/40" },
  { status: ApplicationStatus.OFFER, title: "Offer", color: "border-emerald-500 bg-emerald-50/40" },
  { status: ApplicationStatus.REJECTED, title: "Rejected", color: "border-red-400 bg-red-50/30" },
  { status: ApplicationStatus.ARCHIVED, title: "Archived", color: "border-gray-400 bg-gray-50/50" },
]

export default function PipelinePage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const loadPipeline = async (uid: string) => {
    try {
      setLoading(true)
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/applications?userId=${uid}`, {
        headers: authHeaders,
      })
      const data = await res.json()
      if (data.success) {
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error("Failed to load pipeline:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session.userId)
      loadPipeline(session.userId)
    })
  }, [])

  const moveStatus = async (appId: string, nextStatus: ApplicationStatus) => {
    try {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId ? { ...app, current_status: nextStatus } : app
        )
      )

      const authHeaders = await getAuthHeaders()
      await fetch("/api/applications", {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: appId,
          userId,
          current_status: nextStatus,
        }),
      })
    } catch (err) {
      console.error("Failed to move status:", err)
      loadPipeline(userId)
    }
  }

  const activeColumns = showArchived
    ? PIPELINE_COLUMNS
    : PIPELINE_COLUMNS.filter((c) => c.status !== ApplicationStatus.ARCHIVED)

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Pipeline Board
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Visualize applications with automated 7 & 14-day follow-up tracking
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  showArchived
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {showArchived ? "Hide Archived" : "Show Archived"}
              </button>

              <Link
                href="/dashboard/applications"
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                + New Application
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Board */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-3 text-sm text-gray-500 font-medium">Loading pipeline columns...</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${activeColumns.length > 5 ? 6 : activeColumns.length} gap-4 items-start`}>
            {activeColumns.map((col) => {
              const colApps = applications.filter((a) => a.current_status === col.status)
              return (
                <div
                  key={col.status}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[520px]"
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b-2 ${col.color} flex items-center justify-between`}>
                    <h2 className="font-bold text-gray-900 text-sm tracking-wide">{col.title}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-gray-700 shadow-xs border border-gray-100">
                      {colApps.length}
                    </span>
                  </div>

                  {/* Cards Area */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[75vh]">
                    {colApps.length > 0 ? (
                      colApps.map((app) => {
                        const followUp = getFollowUpInfo(app.applied_date || app.created_at, app.current_status)
                        return (
                          <div
                            key={app.id}
                            className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all group relative"
                          >
                            <div className="flex justify-between items-start">
                              <div className="pr-2">
                                <h3 className="font-bold text-gray-900 text-sm leading-snug">{app.job_title}</h3>
                                <p className="text-xs text-gray-600 font-medium mt-0.5">{app.company_name}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                                {app.days_in_stage}d in stage
                              </span>
                            </div>

                            {app.location && (
                              <p className="text-[11px] text-gray-400 mt-1.5 truncate">📍 {app.location}</p>
                            )}

                            {/* Automated 7 & 14 Day Follow-up Due Alert */}
                            {followUp.status !== "none" && (
                              <div className={`mt-2.5 px-2 py-1 rounded text-[10px] border leading-tight ${followUp.badgeClass}`}>
                                {followUp.label}
                              </div>
                            )}

                            {/* Quick Action Buttons: Move Stage, Reject, Archive */}
                            <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-gray-400 font-medium">Stage:</span>
                                <select
                                  value={app.current_status}
                                  onChange={(e) => moveStatus(app.id, e.target.value as ApplicationStatus)}
                                  className="text-[11px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  {Object.values(ApplicationStatus).map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center justify-end gap-1.5 pt-1">
                                {app.current_status !== ApplicationStatus.REJECTED && (
                                  <button
                                    onClick={() => moveStatus(app.id, ApplicationStatus.REJECTED)}
                                    className="px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                                    title="Mark as Rejected"
                                  >
                                    ✕ Reject
                                  </button>
                                )}
                                {app.current_status !== ApplicationStatus.ARCHIVED && (
                                  <button
                                    onClick={() => moveStatus(app.id, ApplicationStatus.ARCHIVED)}
                                    className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                                    title="Archive Application"
                                  >
                                    📦 Archive
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-10 px-2">
                        <p className="text-xs text-gray-400 italic">No applications</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
