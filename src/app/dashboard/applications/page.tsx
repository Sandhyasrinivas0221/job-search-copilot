"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { Application, ApplicationStatus } from "@/types"

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true)

        // Get current user
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
        )

        const {
          data: { user },
        } = await supabase.auth.getUser()

        // TEST DATA: Fallback to test user for development (COMMENTED OUT FOR PRODUCTION)
        // const userId = user?.id || "00000000-0000-0000-0000-000000000001"

        // PRODUCTION: Require authenticated user
        if (!user) {
          throw new Error("User must be authenticated")
        }
        const userId = user.id

        // Fetch applications with userId parameter
        const res = await fetch(`/api/applications?userId=${userId}`)
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

    fetchApplications()
  }, [])

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to home"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
              <p className="mt-2 text-gray-600">
                Manage all your job applications
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            All ({applications.length})
          </button>
          {Object.values(ApplicationStatus).map((status) => {
            const count = applications.filter(
              (app) => app.current_status === status
            ).length
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? "bg-indigo-600 text-white"
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
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No applications found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Applied
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Days in Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {app.company_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {app.job_title}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          app.current_status
                        )}`}
                      >
                        {app.current_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {app.applied_date
                        ? new Date(app.applied_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {app.days_in_stage}d
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {app.location || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
