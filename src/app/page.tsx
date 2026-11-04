"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession } from "@/lib/client-auth"
import { DashboardMetrics } from "@/types"
import { ResumeUploadModal } from "@/components/ResumeUploadModal"
import { UserCareerProfile } from "@/app/api/user/profile/route"

export default function Home() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [profile, setProfile] = useState<UserCareerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [userSession, setUserSession] = useState<{ userId: string; isDemo: boolean } | null>(null)
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false)
  const [syncingInbox, setSyncingInbox] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  const loadData = async (uid: string) => {
    try {
      const [metricsRes, profileRes] = await Promise.all([
        fetch(`/api/metrics?userId=${uid}`),
        fetch(`/api/user/profile?userId=${uid}`),
      ])

      const metricsData = await metricsRes.json()
      if (metricsData.metrics) {
        setMetrics(metricsData.metrics)
      }

      const profileData = await profileRes.json()
      if (profileData.profile) {
        setProfile(profileData.profile)
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClientSession().then((session) => {
      setUserSession({ userId: session.userId, isDemo: session.isDemo })
      loadData(session.userId)
    })
  }, [])

  const handleSyncInbox = async () => {
    if (!userSession?.userId || syncingInbox) return
    try {
      setSyncingInbox(true)
      setSyncFeedback("Connecting to Gmail to parse latest job applications...")
      const res = await fetch(`/api/agents/sync-inbox?userId=${userSession.userId}`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success) {
        setSyncFeedback(`Successfully synced! Processed ${data.parsedApplicationsCount || 0} applications.`)
        loadData(userSession.userId)
        setTimeout(() => setSyncFeedback(null), 4000)
      } else {
        setSyncFeedback(data.message || "No new application emails found.")
        setTimeout(() => setSyncFeedback(null), 4000)
      }
    } catch {
      setSyncFeedback("Sync failed. Check Gmail connection.")
      setTimeout(() => setSyncFeedback(null), 4000)
    } finally {
      setSyncingInbox(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Header */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 mb-3">
                <span>🤖</span> Autonomous Multi-Agent Copilot
              </span>
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                Job Search Copilot
              </h1>
              <p className="mt-2 text-lg text-gray-600 max-w-2xl">
                Supercharge your career search with intelligent agents tracking applications, finding matching roles, and closing skill gaps.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/applications"
                className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                + Add Application
              </Link>
              <Link
                href="/dashboard/suggestions"
                className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 transition-colors"
              >
                View Matches →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Connecting to job search copilot...</p>
          </div>
        ) : (
          <>
            {/* Candidate & Institution Profile Banner */}
            <div className="mb-8 p-6 bg-white rounded-2xl border border-indigo-100 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                      Target Role
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      {profile?.industry_field || "Healthcare & Social Care"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      📍 {profile?.target_location || "United Kingdom"}
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span>{profile?.target_role || "Care Worker"}</span>
                    {profile?.full_name && (
                      <span className="text-sm font-normal text-gray-500">
                        • {profile.full_name}
                      </span>
                    )}
                  </h2>

                  {/* Skills tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs font-semibold text-gray-400 mr-1">Skills:</span>
                    {(profile?.skills || []).slice(0, 8).map((sk) => (
                      <span
                        key={sk}
                        className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700"
                      >
                        {sk}
                      </span>
                    ))}
                    {(profile?.skills || []).length > 8 && (
                      <span className="text-xs text-gray-400 font-medium">
                        +{profile!.skills.length - 8} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setIsResumeModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
                  >
                    <span>📄</span> Upload Resume / CV
                  </button>

                  <button
                    onClick={handleSyncInbox}
                    disabled={syncingInbox}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <span className={syncingInbox ? "animate-spin" : ""}>🔄</span>
                    {syncingInbox ? "Syncing..." : "Sync Indeed Applications"}
                  </button>

                  <Link
                    href="/dashboard/settings?tab=profile"
                    className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    Settings ⚙️
                  </Link>
                </div>
              </div>

              {syncFeedback && (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-xl font-medium flex items-center justify-between">
                  <span>ℹ️ {syncFeedback}</span>
                  <Link href="/dashboard/applications" className="underline font-bold hover:text-indigo-950">
                    View in Applications →
                  </Link>
                </div>
              )}
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricsCard
                title="Total Applications"
                value={metrics?.totalApplications || 0}
                subtitle={`${metrics?.applicationsThisWeek || 0} this week`}
                color="blue"
                icon="📋"
              />
              <MetricsCard
                title="Interview Rate"
                value={`${metrics?.interviewRate || 0}%`}
                subtitle="From submitted apps"
                color="green"
                icon="🎯"
              />
              <MetricsCard
                title="Offer Rate"
                value={`${metrics?.offerRate || 0}%`}
                subtitle="Conversion to offer"
                color="purple"
                icon="🎉"
              />
              <MetricsCard
                title="Rejection Rate"
                value={`${metrics?.rejectionRate || 0}%`}
                subtitle="Screening & rounds"
                color="red"
                icon="📊"
              />
            </div>

            {/* Feature Modules */}
            <div className="mt-10">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Workspaces & Agent Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <DashboardCard
                  title="Pipeline Board"
                  description="Visualize and move your job applications through every interview stage."
                  href="/dashboard/pipeline"
                  icon="📌"
                  badge="Kanban"
                />
                <DashboardCard
                  title="Job Suggestions"
                  description="AI-matched roles scraped from leading platforms based on your skills."
                  href="/dashboard/suggestions"
                  icon="💼"
                  badge="Scored"
                />
                <DashboardCard
                  title="Applications Manager"
                  description="Full table view of all applications with status tags, company, and dates."
                  href="/dashboard/applications"
                  icon="📁"
                  badge="Active"
                />
                <DashboardCard
                  title="Learning Plan"
                  description="Curated learning tasks and resources targeted directly at missing job skills."
                  href="/dashboard/learning"
                  icon="🎓"
                  badge="Curated"
                />
                <DashboardCard
                  title="Analytics & Metrics"
                  description="Deep dive performance metrics, weekly trends, and funnel breakdown."
                  href="/dashboard/metrics"
                  icon="📈"
                  badge="Insights"
                />
                <DashboardCard
                  title="Agent Automation"
                  description="Configure Mail Listener, Market Scanner, and automatic email digest schedule."
                  href="/dashboard/settings"
                  icon="⚙️"
                  badge="6 Agents"
                />
              </div>
            </div>
          </>
        )}

        {userSession && (
          <ResumeUploadModal
            userId={userSession.userId}
            isOpen={isResumeModalOpen}
            onClose={() => setIsResumeModalOpen(false)}
            onSuccess={() => loadData(userSession.userId)}
          />
        )}
      </main>
    </div>
  )
}

interface MetricsCardProps {
  title: string
  value: string | number
  subtitle: string
  color: "blue" | "green" | "purple" | "red"
  icon: string
}

function MetricsCard({ title, value, subtitle, color, icon }: MetricsCardProps) {
  const colorClasses = {
    blue: "bg-blue-50/70 border-blue-200 text-blue-900",
    green: "bg-green-50/70 border-green-200 text-green-900",
    purple: "bg-purple-50/70 border-purple-200 text-purple-900",
    red: "bg-red-50/70 border-red-200 text-red-900",
  }

  return (
    <div className={`p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-500">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-extrabold text-gray-900">{value}</div>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}

interface DashboardCardProps {
  title: string
  description: string
  href: string
  icon: string
  badge: string
}

function DashboardCard({ title, description, href, icon, badge }: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="group relative p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-3xl p-2.5 bg-gray-50 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
          {badge}
        </span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
      <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 gap-1 group-hover:gap-2 transition-all">
        Open Workspace <span>→</span>
      </div>
    </Link>
  )
}
