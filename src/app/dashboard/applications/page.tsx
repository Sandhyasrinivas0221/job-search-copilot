"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession, getAuthHeaders } from "@/lib/client-auth"
import { Application, ApplicationStatus } from "@/types"
import { getFollowUpInfo } from "@/lib/follow-up"

interface InterviewDetails {
  date: string
  time: string
  location: string
  round?: string
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [activeTab, setActiveTab] = useState<"table" | "interviews">("table")
  const [filter, setFilter] = useState<string>("active")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Interview scheduling modal
  const [schedulingApp, setSchedulingApp] = useState<Application | null>(null)
  const [interviewDate, setInterviewDate] = useState("")
  const [interviewTime, setInterviewTime] = useState("")
  const [interviewLocation, setInterviewLocation] = useState("")
  const [interviewRound, setInterviewRound] = useState("First Round Screening")

  // New application form state
  const [newCompany, setNewCompany] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newStatus, setNewStatus] = useState<ApplicationStatus>(ApplicationStatus.APPLIED)
  const [newLocation, setNewLocation] = useState("")
  const [newJobUrl, setNewJobUrl] = useState("")
  const [newSalaryMin, setNewSalaryMin] = useState("")
  const [newSalaryMax, setNewSalaryMax] = useState("")

  const loadApplications = async (uid: string) => {
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
      console.error("Failed to fetch applications:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session.userId)
      loadApplications(session.userId)
    })
  }, [])

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompany || !newTitle || !userId) return

    try {
      setSubmitting(true)
      const authHeaders = await getAuthHeaders()
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          company_name: newCompany,
          job_title: newTitle,
          current_status: newStatus,
          location: newLocation || null,
          job_url: newJobUrl || null,
          salary_min: newSalaryMin ? Number(newSalaryMin) : null,
          salary_max: newSalaryMax ? Number(newSalaryMax) : null,
        }),
      })

      const data = await res.json()
      if (data.success && data.application) {
        setApplications((prev) => [data.application, ...prev])
        setIsModalOpen(false)
        setNewCompany("")
        setNewTitle("")
        setNewStatus(ApplicationStatus.APPLIED)
        setNewLocation("")
        setNewJobUrl("")
        setNewSalaryMin("")
        setNewSalaryMax("")
      }
    } catch (err) {
      console.error("Failed to create application:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (appId: string, nextStatus: ApplicationStatus) => {
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
      console.error("Failed to update status:", err)
      loadApplications(userId)
    }
  }

  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schedulingApp || !interviewDate) return

    try {
      setSubmitting(true)
      const interviewMeta: InterviewDetails = {
        date: interviewDate,
        time: interviewTime || "TBD",
        location: interviewLocation || "Video Link / Google Meet",
        round: interviewRound,
      }

      const descriptionPayload = JSON.stringify({
        ...(schedulingApp.description ? { original: schedulingApp.description } : {}),
        interview: interviewMeta,
      })

      setApplications((prev) =>
        prev.map((app) =>
          app.id === schedulingApp.id
            ? { ...app, current_status: ApplicationStatus.INTERVIEW, description: descriptionPayload }
            : app
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
          id: schedulingApp.id,
          userId,
          current_status: ApplicationStatus.INTERVIEW,
          description: descriptionPayload,
        }),
      })

      setSchedulingApp(null)
      setInterviewDate("")
      setInterviewTime("")
      setInterviewLocation("")
    } catch (err) {
      console.error("Failed to save interview:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (appId: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return

    try {
      setApplications((prev) => prev.filter((a) => a.id !== appId))
      const authHeaders = await getAuthHeaders()
      await fetch(`/api/applications?id=${appId}&userId=${userId}`, {
        method: "DELETE",
        headers: authHeaders,
      })
    } catch (err) {
      console.error("Failed to delete application:", err)
      loadApplications(userId)
    }
  }

  const parseInterview = (app: Application): InterviewDetails | null => {
    if (!app.description) {
      if (app.current_status === ApplicationStatus.INTERVIEW) {
        return {
          date: app.applied_date || app.created_at,
          time: "Scheduled",
          location: app.location || "Online Meeting",
          round: "Interview Stage",
        }
      }
      return null
    }
    try {
      const parsed = JSON.parse(app.description)
      return parsed.interview || null
    } catch {
      if (app.current_status === ApplicationStatus.INTERVIEW) {
        return {
          date: app.applied_date || app.created_at,
          time: "Scheduled",
          location: app.location || "Online Meeting",
          round: "Interview Stage",
        }
      }
      return null
    }
  }

  const filteredApplications = applications.filter((app) => {
    if (filter === "all") return true
    if (filter === "active") {
      return (
        app.current_status !== ApplicationStatus.REJECTED &&
        app.current_status !== ApplicationStatus.ARCHIVED
      )
    }
    return app.current_status === filter
  })

  const interviewApplications = applications.filter(
    (app) => app.current_status === ApplicationStatus.INTERVIEW || parseInterview(app) !== null
  )

  const getStatusColor = (status: ApplicationStatus) => {
    const colors: Record<ApplicationStatus, string> = {
      [ApplicationStatus.APPLIED]: "bg-blue-100 text-blue-800",
      [ApplicationStatus.SCREENING]: "bg-purple-100 text-purple-800",
      [ApplicationStatus.INTERVIEW]: "bg-yellow-100 text-yellow-800",
      [ApplicationStatus.OFFER]: "bg-green-100 text-green-800",
      [ApplicationStatus.REJECTED]: "bg-red-100 text-red-800",
      [ApplicationStatus.ACCEPTED]: "bg-emerald-100 text-emerald-800",
      [ApplicationStatus.ARCHIVED]: "bg-gray-100 text-gray-800",
      [ApplicationStatus.NEEDS_REVIEW]: "bg-orange-100 text-orange-800",
      [ApplicationStatus.FOLLOW_UP_SUGGESTED]: "bg-indigo-100 text-indigo-800",
      [ApplicationStatus.NO_RESPONSE]: "bg-slate-100 text-slate-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Job Applications
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track statuses, 7 & 14-day follow-ups, and upcoming interviews
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/pipeline"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-xs"
              >
                📊 Pipeline Board
              </Link>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                + Add Application
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Table vs Interviews */}
          <div className="mt-6 flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("table")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "table"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              📋 All Applications ({applications.length})
            </button>
            <button
              onClick={() => setActiveTab("interviews")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "interviews"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span>📅 Interviews View</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 font-bold">
                {interviewApplications.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "interviews" ? (
          /* ============= INTERVIEWS VIEW ============= */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Scheduled Interviews</h2>
                <p className="text-xs text-gray-500">Upcoming conversations, times, and meeting locations</p>
              </div>
            </div>

            {interviewApplications.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
                <span className="text-4xl">🎙️</span>
                <h3 className="mt-3 text-base font-semibold text-gray-900">No interviews scheduled yet</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                  When a company reaches out, click <strong>"Schedule Interview"</strong> on any application to log date, time, and meeting link.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {interviewApplications.map((app) => {
                  const interview = parseInterview(app)
                  return (
                    <div
                      key={app.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow relative"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 mb-2">
                            {interview?.round || "Interview"}
                          </span>
                          <h3 className="text-base font-bold text-gray-900">{app.job_title}</h3>
                          <p className="text-sm text-gray-600 font-medium">{app.company_name}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-gray-700">
                          <span className="text-base">📅</span>
                          <span className="font-semibold">{interview?.date || "Date Pending"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <span className="text-base">⏰</span>
                          <span>{interview?.time || "Time TBD"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-indigo-700">
                          <span className="text-base">📍</span>
                          <span className="truncate">{interview?.location || "Video Link / Zoom"}</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSchedulingApp(app)
                            setInterviewDate(interview?.date || "")
                            setInterviewTime(interview?.time || "")
                            setInterviewLocation(interview?.location || "")
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 cursor-pointer"
                        >
                          Edit Details
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStatusChange(app.id, ApplicationStatus.OFFER)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 cursor-pointer"
                          >
                            🎉 Got Offer!
                          </button>
                          <button
                            onClick={() => handleStatusChange(app.id, ApplicationStatus.REJECTED)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* ============= TABLE VIEW ============= */
          <>
            {/* Filter Pills with Active Default */}
            <div className="mb-6 flex gap-2 flex-wrap items-center">
              <button
                onClick={() => setFilter("active")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filter === "active"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Active Applications ({applications.filter((a) => a.current_status !== ApplicationStatus.REJECTED && a.current_status !== ApplicationStatus.ARCHIVED).length})
              </button>
              
              <button
                onClick={() => setFilter("all")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filter === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                All ({applications.length})
              </button>

              {[
                ApplicationStatus.APPLIED,
                ApplicationStatus.SCREENING,
                ApplicationStatus.INTERVIEW,
                ApplicationStatus.OFFER,
                ApplicationStatus.REJECTED,
                ApplicationStatus.ARCHIVED,
              ].map((status) => {
                const count = applications.filter((app) => app.current_status === status).length
                return (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      filter === status
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {status} ({count})
                  </button>
                )
              })}
            </div>

            {loading ? (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                <p className="mt-3 text-sm text-gray-500 font-medium">Loading applications...</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
                <span className="text-4xl">📄</span>
                <h3 className="mt-3 text-base font-semibold text-gray-900">No applications match this filter</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try selecting "All" or create a new job application.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  + Create First Application
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Company & Role</th>
                        <th className="px-6 py-3.5">Stage</th>
                        <th className="px-6 py-3.5">Follow-up Due</th>
                        <th className="px-6 py-3.5">Location & Salary</th>
                        <th className="px-6 py-3.5">Applied Date</th>
                        <th className="px-6 py-3.5 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {filteredApplications.map((app) => {
                        const followUp = getFollowUpInfo(app.applied_date || app.created_at, app.current_status)
                        return (
                          <tr key={app.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{app.job_title}</div>
                              <div className="text-xs text-gray-500 font-medium">{app.company_name}</div>
                              {app.job_url && (
                                <a
                                  href={app.job_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 hover:underline mt-0.5 inline-block"
                                >
                                  Job Listing ↗
                                </a>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={app.current_status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                                className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer ${getStatusColor(
                                  app.current_status
                                )} focus:ring-2 focus:ring-indigo-500`}
                              >
                                {Object.values(ApplicationStatus).map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              {followUp.status !== "none" ? (
                                <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] border font-medium ${followUp.badgeClass}`}>
                                  {followUp.label}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-600 text-xs">
                              <div>{app.location || "Remote / Not specified"}</div>
                              {app.salary_min && (
                                <div className="text-gray-400 font-medium">
                                  ${app.salary_min.toLocaleString()} - ${app.salary_max?.toLocaleString() || "..."}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-500 text-xs">
                              {app.applied_date ? new Date(app.applied_date).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => {
                                    setSchedulingApp(app)
                                    setInterviewDate(new Date().toISOString().split("T")[0])
                                  }}
                                  className="text-[11px] font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-2 py-1 rounded border border-yellow-200 transition-colors cursor-pointer"
                                  title="Schedule Interview Date & Time"
                                >
                                  📅 Interview
                                </button>
                                {app.current_status !== ApplicationStatus.REJECTED && (
                                  <button
                                    onClick={() => handleStatusChange(app.id, ApplicationStatus.REJECTED)}
                                    className="text-[11px] font-medium text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-200 transition-colors cursor-pointer"
                                    title="Mark as Rejected"
                                  >
                                    ✕ Reject
                                  </button>
                                )}
                                {app.current_status !== ApplicationStatus.ARCHIVED && (
                                  <button
                                    onClick={() => handleStatusChange(app.id, ApplicationStatus.ARCHIVED)}
                                    className="text-[11px] font-medium text-gray-600 hover:bg-gray-100 px-2 py-1 rounded border border-gray-200 transition-colors cursor-pointer"
                                    title="Archive Application"
                                  >
                                    📦 Archive
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(app.id)}
                                  className="text-[11px] text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100 transition-colors"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Schedule Interview Modal */}
      {schedulingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Schedule Interview</h3>
                <p className="text-xs text-gray-500">{schedulingApp.job_title} at {schedulingApp.company_name}</p>
              </div>
              <button
                onClick={() => setSchedulingApp(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInterview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Interview Date *</label>
                <input
                  type="date"
                  required
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Location or Video Link</label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet, Zoom URL, or Office Address"
                  value={interviewLocation}
                  onChange={(e) => setInterviewLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Stage / Round</label>
                <select
                  value={interviewRound}
                  onChange={(e) => setInterviewRound(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="First Round Screening">First Round Screening</option>
                  <option value="Technical Interview">Technical Interview</option>
                  <option value="System Design">System Design</option>
                  <option value="Hiring Manager Chat">Hiring Manager Chat</option>
                  <option value="Final Round / Onsite">Final Round / Onsite</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSchedulingApp(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Interview"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add New Job Application</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe, NHS, Google, Acme Inc"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Care Worker, Frontend Engineer, Registered Nurse"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {Object.values(ApplicationStatus).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. London, UK or Remote"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job URL / Listing Link</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newJobUrl}
                  onChange={(e) => setNewJobUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Salary Min ($ or £)</label>
                  <input
                    type="number"
                    placeholder="30000"
                    value={newSalaryMin}
                    onChange={(e) => setNewSalaryMin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Salary Max ($ or £)</label>
                  <input
                    type="number"
                    placeholder="50000"
                    value={newSalaryMax}
                    onChange={(e) => setNewSalaryMax(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? "Saving..." : "Create Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
