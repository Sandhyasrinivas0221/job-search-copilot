"use client"

import { useEffect, useState } from "react"
import { Application, ApplicationStatus } from "@/types"

export default function PipelinePage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const userId = urlParams.get("userId") || "demo-user"
    setUserId(userId)

    const fetchApplications = async () => {
      try {
        const res = await fetch(`/api/applications?userId=${userId}`)
        const data = await res.json()
        if (data.applications) {
          setApplications(data.applications)
        }
      } catch (error) {
        console.error("Failed to fetch applications:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [])

  const statuses = Object.values(ApplicationStatus)
  const applicationsByStatus = statuses.reduce(
    (acc, status) => {
      acc[status] = applications.filter((app) => app.current_status === status)
      return acc
    },
    {} as Record<ApplicationStatus, Application[]>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading pipeline...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Pipeline Board</h1>
          <p className="mt-2 text-gray-600">View your job applications by stage</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {statuses.map((status) => (
            <div key={status} className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{status}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {applicationsByStatus[status].length} applications
                </p>
              </div>

              <div className="p-4 space-y-3">
                {applicationsByStatus[status].length > 0 ? (
                  applicationsByStatus[status].map((app) => (
                    <div key={app.id} className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-indigo-400">
                      <h3 className="font-medium text-gray-900 text-sm">{app.job_title}</h3>
                      <p className="text-xs text-gray-600 mt-1">{app.company_name}</p>
                      {app.location && (
                        <p className="text-xs text-gray-600">{app.location}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Days in stage: {app.days_in_stage}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic">No applications</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
