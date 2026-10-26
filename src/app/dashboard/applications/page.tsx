"use client"

import { useEffect, useState } from "react"
import { getClientSession } from "@/lib/client-auth"
import { Application, ApplicationStatus } from "@/types"

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [filter, setFilter] = useState<string>("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
      const res = await fetch(`/api/applications?userId=${uid}`)
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
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        // Reset form
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
      // Optimistic update
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
      console.error("Failed to update status:", err)
      loadApplications(userId)
    }
  }

  const handleDelete = async (appId: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return

    try {
      setApplications((prev) => prev.filter((a) => a.id !== appId))
      await fetch(`/api/applications?id=${appId}`, { method: "DELETE" })
    } catch (err) {
      console.error("Failed to delete application:", err)
      loadApplications(userId)
    }
  }

  const filteredApplications =
    filter === "all"
      ? applications
      : applications.filter((app) => app.current_status === filter)

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
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Job Applications
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage and track all your active job opportunities
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              + Add Application
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Pills */}
        <div className="mb-6 flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            All ({applications.length})
          </button>
          {Object.values(ApplicationStatus).map((status) => {
            const count = applications.filter((app) => app.current_status === status).length
            if (count === 0 && filter !== status) return null
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-3 text-sm text-gray-500 font-medium">Loading applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
            <span className="text-4xl">📄</span>
            <h3 className="mt-3 text-base font-semibold text-gray-900">No applications found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === "all"
                ? "Get started by adding your first job application or importing suggestions."
                : `No applications with status '${filter}'.`}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
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
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Location & Salary</th>
                    <th className="px-6 py-3.5">Applied Date</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredApplications.map((app) => (
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
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add New Job Application</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
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
                  placeholder="e.g. Stripe, Google, Acme Inc"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                    placeholder="e.g. Remote / New York"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newJobUrl}
                  onChange={(e) => setNewJobUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Min Salary ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 120000"
                    value={newSalaryMin}
                    onChange={(e) => setNewSalaryMin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Max Salary ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={newSalaryMax}
                    onChange={(e) => setNewSalaryMax(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
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
