"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession } from "@/lib/client-auth"
import { Application, ApplicationStatus } from "@/types"

const PIPELINE_COLUMNS: { status: ApplicationStatus; title: string; color: string }[] = [
  { status: ApplicationStatus.APPLIED, title: "Applied", color: "border-blue-500 bg-blue-50/40" },
  { status: ApplicationStatus.SCREENING, title: "Screening", color: "border-purple-500 bg-purple-50/40" },
  { status: ApplicationStatus.INTERVIEW, title: "Interview", color: "border-yellow-500 bg-yellow-50/40" },
  { status: ApplicationStatus.OFFER, title: "Offer", color: "border-emerald-500 bg-emerald-50/40" },
  { status: ApplicationStatus.REJECTED, title: "Rejected", color: "border-red-400 bg-red-50/30" },
]

export default function PipelinePage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")

  const loadPipeline = async (uid: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/applications?userId=${uid}`)
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

      await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
                Visualize and advance your applications stage by stage
              </p>
            </div>
            <Link
              href="/dashboard/applications"
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              + New Application
            </Link>
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
            {PIPELINE_COLUMNS.map((col) => {
              const colApps = applications.filter((a) => a.current_status === col.status)
              return (
                <div
                  key={col.status}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[500px]"
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b-2 ${col.color} flex items-center justify-between`}>
                    <h2 className="font-bold text-gray-900 text-sm tracking-wide">{col.title}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-gray-700 shadow-xs border border-gray-100">
                      {colApps.length}
                    </span>
                  </div>

                  {/* Cards Area */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    {colApps.length > 0 ? (
                      colApps.map((app) => (
                        <div
                          key={app.id}
                          className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-gray-900 text-sm">{app.job_title}</h3>
                              <p className="text-xs text-gray-500 font-medium mt-0.5">{app.company_name}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {app.days_in_stage}d
                            </span>
                          </div>

                          {app.location && (
                            <p className="text-[11px] text-gray-400 mt-2 truncate">📍 {app.location}</p>
                          )}

                          {/* Quick Stage Move Dropdown */}
                          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-medium">Stage:</span>
                            <select
                              value={app.current_status}
                              onChange={(e) => moveStatus(app.id, e.target.value as ApplicationStatus)}
                              className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              {Object.values(ApplicationStatus).map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
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
