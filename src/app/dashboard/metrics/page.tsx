"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession } from "@/lib/client-auth"
import { DashboardMetrics } from "@/types"

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")

  const loadMetrics = async (uid: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/metrics?userId=${uid}`)
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

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session.userId)
      loadMetrics(session.userId)
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Search Analytics & Funnel
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Detailed performance analytics, conversion rates, and volume metrics
              </p>
            </div>
            <Link
              href="/dashboard/pipeline"
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 transition-colors"
            >
              View Pipeline Board →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-3 text-sm text-gray-500 font-medium">Aggregating search metrics...</p>
          </div>
        ) : !metrics ? (
          <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
            <span className="text-4xl">📊</span>
            <h3 className="mt-3 text-base font-semibold text-gray-900">No metrics data available</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start by submitting applications to see your conversion analytics.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Total Applications
                </span>
                <div className="text-3xl font-extrabold text-gray-900 mt-2">
                  {metrics.totalApplications}
                </div>
                <p className="text-xs text-gray-500 mt-1">All recorded job entries</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Velocity
                </span>
                <div className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {metrics.applicationsThisWeek}
                </div>
                <p className="text-xs text-gray-500 mt-1">Submitted in last 7 days</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Interview Rate
                </span>
                <div className="text-3xl font-extrabold text-emerald-600 mt-2">
                  {metrics.interviewRate}%
                </div>
                <p className="text-xs text-gray-500 mt-1">Applications reaching interview</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Offer Rate
                </span>
                <div className="text-3xl font-extrabold text-purple-600 mt-2">
                  {metrics.offerRate}%
                </div>
                <p className="text-xs text-gray-500 mt-1">Conversion to job offers</p>
              </div>
            </div>

            {/* Funnel Progress Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-6">Application Conversion Funnel</h2>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-700">1. Applications Submitted</span>
                    <span className="text-gray-900">{metrics.totalApplications} (100%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-indigo-600 h-3 rounded-full w-full"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-700">2. Interviews Secured</span>
                    <span className="text-emerald-700">{metrics.interviewRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, metrics.interviewRate))}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-700">3. Offers Received</span>
                    <span className="text-purple-700">{metrics.offerRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(3, metrics.offerRate))}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-700">4. Rejection Rate</span>
                    <span className="text-red-700">{metrics.rejectionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-red-400 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, metrics.rejectionRate))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
