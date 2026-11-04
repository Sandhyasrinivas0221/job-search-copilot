"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession } from "@/lib/client-auth"
import { JobSuggestion } from "@/types"

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [userId, setUserId] = useState("")
  const [easyApplyOnly, setEasyApplyOnly] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [appliedSuccess, setAppliedSuccess] = useState<string | null>(null)
  const [targetRole, setTargetRole] = useState("Care Worker")
  const [targetLocation, setTargetLocation] = useState("United Kingdom")

  const loadSuggestions = async (uid: string) => {
    try {
      setLoading(true)
      const [sugRes, profRes] = await Promise.all([
        fetch(`/api/suggestions?userId=${uid}&applied=false&dismissed=false`),
        fetch(`/api/user/profile?userId=${uid}`),
      ])

      const sugData = await sugRes.json()
      if (sugData.suggestions) {
        setSuggestions(sugData.suggestions)
      }

      const profData = await profRes.json()
      if (profData.profile) {
        if (profData.profile.target_role) setTargetRole(profData.profile.target_role)
        if (profData.profile.target_location) setTargetLocation(profData.profile.target_location)
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerMarketScan = async () => {
    if (!userId || scanning) return
    try {
      setScanning(true)
      const res = await fetch(`/api/cron/trigger-jobs?userId=${userId}`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success || data.suggestionsCreated > 0) {
        setAppliedSuccess(`Role Finder Agent discovered ${data.suggestionsCreated || 4} new tailored positions!`)
        setTimeout(() => setAppliedSuccess(null), 5000)
        loadSuggestions(userId)
      }
    } catch (err) {
      console.error("Failed to trigger job search:", err)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session.userId)
      loadSuggestions(session.userId)
    })
  }, [])

  const handleApplyToJob = async (job: JobSuggestion) => {
    try {
      setActionInProgress(job.id)
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion: job,
          userId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setAppliedSuccess(`Added "${job.job_title} at ${job.company_name}" to your pipeline!`)
        setSuggestions((prev) => prev.filter((s) => s.id !== job.id))
        setTimeout(() => setAppliedSuccess(null), 5000)
      }
    } catch (err) {
      console.error("Failed to apply:", err)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDismiss = async (jobId: string) => {
    try {
      setSuggestions((prev) => prev.filter((s) => s.id !== jobId))
      await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, dismissed: true }),
      })
    } catch (err) {
      console.error("Failed to dismiss:", err)
      loadSuggestions(userId)
    }
  }

  const displayedSuggestions = easyApplyOnly
    ? suggestions.filter((s) => s.easy_apply)
    : suggestions

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Recommended Job Matches
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                AI-matched roles discovered based on your current skills & preferences
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
        {appliedSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs">
            <span>🎉 {appliedSuccess}</span>
            <Link href="/dashboard/pipeline" className="underline hover:text-emerald-900">
              Open in Pipeline →
            </Link>
          </div>
        )}

        {/* Role & Search Header */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Active Candidate Preference
              </p>
              <h2 className="text-base font-bold text-gray-900">
                {targetRole} <span className="text-gray-400 font-normal">in</span> {targetLocation}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTriggerMarketScan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
            >
              <span className={scanning ? "animate-spin" : ""}>🔄</span>
              {scanning ? "Scanning Live Market..." : "Scan Market for Matches"}
            </button>

            <a
              href={`https://uk.indeed.com/jobs?q=${encodeURIComponent(targetRole)}&l=${encodeURIComponent(targetLocation)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Indeed UK ↗
            </a>

            <a
              href={`https://www.reed.co.uk/jobs/${encodeURIComponent(targetRole.toLowerCase().replace(/\s+/g, "-"))}-jobs`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              Reed UK ↗
            </a>

            <a
              href="https://www.jobs.nhs.uk/candidate/search"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              NHS Jobs ↗
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEasyApplyOnly(!easyApplyOnly)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                easyApplyOnly
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              ✨ Easy Apply Only
            </button>
            <span className="text-xs text-gray-500 font-medium">
              Showing {displayedSuggestions.length} available opportunities
            </span>
          </div>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-3 text-sm text-gray-500 font-medium">Scanning for matching roles...</p>
          </div>
        ) : displayedSuggestions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
            <span className="text-4xl">💼</span>
            <h3 className="mt-3 text-base font-semibold text-gray-900">No new job suggestions stored yet</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
              Click below to run the autonomous Job Market Agent to find matching openings in {targetLocation} for {targetRole}.
            </p>
            <button
              onClick={handleTriggerMarketScan}
              disabled={scanning}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <span>🤖</span> {scanning ? "Scanning Job Boards..." : "Run Job Finder Agent Now"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedSuggestions.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base leading-snug">
                        {job.job_title}
                      </h3>
                      <p className="text-xs text-gray-500 font-semibold mt-0.5">{job.company_name}</p>
                    </div>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        job.match_score >= 80
                          ? "bg-emerald-100 text-emerald-800"
                          : job.match_score >= 60
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {Math.round(job.match_score)}% match
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    {job.location && <p>📍 {job.location}</p>}
                    {job.salary_min && (
                      <p className="font-medium text-gray-700">
                        💰 ${job.salary_min.toLocaleString()} - ${job.salary_max?.toLocaleString() || "..."}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400">Source: {job.source_site || "Aggregator"}</p>
                  </div>

                  {job.description && (
                    <p className="text-xs text-gray-600 line-clamp-3 mb-5 leading-relaxed bg-gray-50 p-2.5 rounded-lg">
                      {job.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDismiss(job.id)}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1.5"
                  >
                    Dismiss
                  </button>

                  <div className="flex items-center gap-2">
                    {job.job_url && (
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                      >
                        View Post ↗
                      </a>
                    )}
                    <button
                      onClick={() => handleApplyToJob(job)}
                      disabled={actionInProgress === job.id}
                      className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                    >
                      {actionInProgress === job.id ? "Adding..." : "+ Add to Pipeline"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
