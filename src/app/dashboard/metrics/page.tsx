"use client"

import { useEffect, useState } from "react"
import { DashboardMetrics } from "@/types"

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const userId = urlParams.get("userId") || "demo-user"
    setUserId(userId)

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`/api/metrics?userId=${userId}`)
        const data = await res.json()
        if (data.metrics) {
          setMetrics(data.metrics)
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading metrics...</p>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Metrics</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-gray-600">No data available</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Performance Metrics</h1>
          <p className="mt-2 text-gray-600">Track your job search progress</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard title="Total Applications" value={metrics.totalApplications} color="blue" />
          <MetricCard title="Interview Rate" value={`${metrics.interviewRate.toFixed(1)}%`} color="green" />
          <MetricCard title="Offer Rate" value={`${metrics.offerRate.toFixed(1)}%`} color="purple" />
          <MetricCard title="Rejection Rate" value={`${metrics.rejectionRate.toFixed(1)}%`} color="red" />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Applications This Week"
            value={metrics.applicationsThisWeek}
            color="indigo"
          />
          <MetricCard
            title="Avg Days to Interview"
            value={metrics.averageDaysToInterview}
            color="yellow"
          />
          <MetricCard
            title="Learning Progress"
            value={`${metrics.learningProgress}%`}
            color="cyan"
          />
        </div>

        {/* Top Companies */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Companies</h2>
          <div className="space-y-3">
            {metrics.topCompanies.length > 0 ? (
              metrics.topCompanies.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-700">{item.company}</span>
                  <span className="text-sm font-medium text-indigo-600">{item.count} applications</span>
                </div>
              ))
            ) : (
              <p className="text-gray-600 italic">No applications yet</p>
            )}
          </div>
        </div>

        {/* Top Rejection Reasons */}
        {metrics.topRejectionReasons.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">common Rejection Reasons</h2>
            <div className="space-y-3">
              {metrics.topRejectionReasons.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-700">{item.reason}</span>
                  <span className="text-sm font-medium text-red-600">{item.count} rejections</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Interviews */}
        {metrics.upcomingInterviews.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Interviews</h2>
            <div className="space-y-3">
              {metrics.upcomingInterviews.map((app) => (
                <div key={app.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                  <h3 className="font-medium text-gray-900">{app.job_title}</h3>
                  <p className="text-sm text-gray-600">{app.company_name}</p>
                  <p className="text-xs text-gray-500 mt-1">Days in stage: {app.days_in_stage}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Offers */}
        {metrics.recentOffers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Offers 🎉</h2>
            <div className="space-y-3">
              {metrics.recentOffers.map((app) => (
                <div key={app.id} className="p-3 bg-green-50 rounded border border-green-200">
                  <h3 className="font-medium text-gray-900">{app.job_title}</h3>
                  <p className="text-sm text-gray-600">{app.company_name}</p>
                  {app.salary_min && app.salary_max && (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      ${app.salary_min.toLocaleString()} - ${app.salary_max.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  color: "blue" | "green" | "purple" | "red" | "indigo" | "yellow" | "cyan"
}

function MetricCard({ title, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    red: "bg-red-50 text-red-600 border-red-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
    cyan: "bg-cyan-50 text-cyan-600 border-cyan-200",
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}
