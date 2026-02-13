"use client"

import { useEffect, useState } from "react"

export default function Home() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/metrics")
        const data = await res.json()
        setMetrics(data)
      } catch (error) {
        console.error("Failed to fetch metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Job Search Copilot</h1>
          <p className="mt-2 text-gray-600">
            Multi-agent assistant for your job search journey
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Metrics Cards */}
            <MetricsCard
              title="Total Applications"
              value={metrics?.totalApplications || 0}
              color="blue"
            />
            <MetricsCard
              title="Interview Rate"
              value={metrics?.interviewRate || "0%"}
              color="green"
            />
            <MetricsCard
              title="Offer Rate"
              value={metrics?.offerRate || "0%"}
              color="purple"
            />
            <MetricsCard
              title="Rejection Rate"
              value={metrics?.rejectionRate || "0%"}
              color="red"
            />
          </div>
        )}

        {/* Dashboard Navigation */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="Pipeline Board"
            description="View applications by stage"
            href="/dashboard/pipeline"
          />
          <DashboardCard
            title="Job Suggestions"
            description="Today's recommended roles"
            href="/dashboard/suggestions"
          />
          <DashboardCard
            title="Learning Plan"
            description="Track your skill development"
            href="/dashboard/learning"
          />
          <DashboardCard
            title="Metrics"
            description="Detailed performance analytics"
            href="/dashboard/metrics"
          />
          <DashboardCard
            title="Applications"
            description="Manage all applications"
            href="/dashboard/applications"
          />
          <DashboardCard
            title="Settings"
            description="Configure your agents"
            href="/dashboard/settings"
          />
        </div>
      </main>
    </div>
  )
}

interface MetricsCardProps {
  title: string
  value: string | number
  color: "blue" | "green" | "purple" | "red"
}

function MetricsCard({ title, value, color }: MetricsCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    red: "bg-red-50 text-red-600 border-red-200",
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

interface DashboardCardProps {
  title: string
  description: string
  href: string
}

function DashboardCard({ title, description, href }: DashboardCardProps) {
  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
    >
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-600">{description}</p>
    </a>
  )
}
