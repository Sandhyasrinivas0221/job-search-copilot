"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession, getAuthHeaders } from "@/lib/client-auth"
import { JobSuggestion } from "@/types"

const PRESET_ROLES = [
  { label: "Care Assistant", icon: "🤝", role: "Care Assistant", location: "United Kingdom" },
  { label: "Registered Nurse", icon: "🩺", role: "Registered Nurse", location: "United Kingdom" },
  { label: "Software Engineer", icon: "💻", role: "Software Engineer", location: "United Kingdom" },
  { label: "Teaching Assistant", icon: "📚", role: "Teaching Assistant", location: "United Kingdom" },
  { label: "Office Admin", icon: "📋", role: "Office Administrator", location: "United Kingdom" },
  { label: "Digital Marketing", icon: "📈", role: "Digital Marketing Specialist", location: "United Kingdom" },
  { label: "Finance & Accounts", icon: "📊", role: "Accountant", location: "United Kingdom" },
  { label: "Customer Support", icon: "🎧", role: "Customer Support Specialist", location: "United Kingdom" },
]

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
  const [searchQuery, setSearchQuery] = useState("")

  const loadSuggestions = async (uid: string, autoScanIfEmpty = false) => {
    try {
      setLoading(true)
      const authHeaders = await getAuthHeaders()
      const [sugRes, profRes] = await Promise.all([
        fetch(`/api/suggestions?userId=${uid}&applied=false&dismissed=false`, { headers: authHeaders }),
        fetch(`/api/user/profile?userId=${uid}`, { headers: authHeaders }),
      ])

      const sugData = await sugRes.json()
      let currentSuggestions: JobSuggestion[] = []
      if (sugData.suggestions) {
        currentSuggestions = sugData.suggestions
        setSuggestions(currentSuggestions)
      }

      let currentRole = targetRole
      let currentLoc = targetLocation
      const profData = await profRes.json()
      if (profData.profile) {
        if (profData.profile.target_role) {
          currentRole = profData.profile.target_role
          setTargetRole(currentRole)
        }
        if (profData.profile.target_location) {
          currentLoc = profData.profile.target_location
          setTargetLocation(currentLoc)
        }
      }

      // Auto-trigger scan on first visit if user has zero stored suggestions
      if (autoScanIfEmpty && currentSuggestions.length === 0) {
        await executeScan(uid, currentRole, currentLoc)
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
    } finally {
      setLoading(false)
    }
  }

  const executeScan = async (uid: string, roleToSearch: string, locToSearch: string) => {
    if (!uid || scanning) return
    try {
      setScanning(true)
      const authHeaders = await getAuthHeaders()
      const queryParams = new URLSearchParams({
        userId: uid,
        role: roleToSearch,
        location: locToSearch,
      })

      const res = await fetch(`/api/cron/trigger-jobs?${queryParams.toString()}`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      })

      const data = await res.json()
      if (data.success || data.suggestionsCreated > 0) {
        setAppliedSuccess(`AI Role Finder discovered ${data.suggestionsCreated || 4} new tailored positions!`)
        setTimeout(() => setAppliedSuccess(null), 5000)

        // Refresh suggestions list
        const sugRes = await fetch(`/api/suggestions?userId=${uid}&applied=false&dismissed=false`, {
          headers: authHeaders,
        })
        const sugData = await sugRes.json()
        if (sugData.suggestions) {
          setSuggestions(sugData.suggestions)
        }
      }
    } catch (err) {
      console.error("Failed to trigger job search:", err)
    } finally {
      setScanning(false)
    }
  }

  const handleTriggerMarketScan = () => {
    executeScan(userId, targetRole, targetLocation)
  }

  const handleSelectPreset = (role: string, loc: string) => {
    setTargetRole(role)
    setTargetLocation(loc)
    executeScan(userId, role, loc)
  }

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session.userId)
      loadSuggestions(session.userId, true)
    })
  }, [])

  const handleApplyToJob = async (job: JobSuggestion) => {
    try {
      setActionInProgress(job.id)
      const authHeaders = await getAuthHeaders()
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
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
      const authHeaders = await getAuthHeaders()
      await fetch("/api/suggestions", {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: jobId, userId, dismissed: true }),
      })
    } catch (err) {
      console.error("Failed to dismiss:", err)
      loadSuggestions(userId)
    }
  }

  const displayedSuggestions = suggestions
    .filter((s) => (!easyApplyOnly || s.easy_apply))
    .filter((s) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        s.job_title.toLowerCase().includes(q) ||
        s.company_name.toLowerCase().includes(q) ||
        (s.location && s.location.toLowerCase().includes(q))
      )
    })

  return (
    <div className="min-h-screen bg-slate-50/80 pb-20">
      {/* Header Banner */}
      <header className="relative bg-gradient-to-b from-white via-white to-slate-50 border-b border-slate-200/80 pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Autonomous Role Finder Agent
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl">
                Curated Job Opportunities
              </h1>
              <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
                Personalized role suggestions tailored to your career preferences, matching skills, and target market.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/pipeline"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <span>📊</span> Pipeline Board
              </Link>
              <Link
                href="/dashboard/applications"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
              >
                <span>📋</span> Applications
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {appliedSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <span className="flex items-center gap-2">
              <span className="text-base">🎉</span>
              {appliedSuccess}
            </span>
            <Link
              href="/dashboard/pipeline"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
            >
              Open Pipeline →
            </Link>
          </div>
        )}

        {/* Dynamic Role Search & Quick Presets Bar */}
        <div className="mb-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Target Profession & Location
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-900">{targetRole}</span>
                <span className="text-sm font-medium text-slate-400">in</span>
                <span className="text-base font-semibold text-slate-700">{targetLocation}</span>
              </div>
            </div>

            {/* Manual Customization Inputs & Scan Button */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Job Role (e.g. Care Worker)"
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
              />
              <input
                type="text"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                placeholder="Location (e.g. United Kingdom)"
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
              />
              <button
                onClick={handleTriggerMarketScan}
                disabled={scanning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xs hover:shadow-md transition-all disabled:opacity-50"
              >
                <span className={scanning ? "animate-spin" : ""}>🔄</span>
                {scanning ? "Scanning Live Market..." : "Scan Market for Matches"}
              </button>
            </div>
          </div>

          {/* Quick Preset Role Chips */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Switch Target Industry / Role:</p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_ROLES.map((preset) => (
                <button
                  key={preset.role}
                  onClick={() => handleSelectPreset(preset.role, preset.location)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    targetRole.toLowerCase() === preset.role.toLowerCase()
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-transparent"
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setEasyApplyOnly(!easyApplyOnly)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                easyApplyOnly
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              ✨ Easy Apply Only
            </button>

            <span className="text-xs text-slate-500 font-medium">
              Showing <strong>{displayedSuggestions.length}</strong> opportunities
            </span>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, company..."
              className="w-full px-3.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Job Listings Grid */}
        {loading ? (
          <div className="text-center py-24 bg-white rounded-2xl shadow-xs border border-slate-200">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-indigo-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-slate-600 font-semibold">Scanning live job markets for matches...</p>
            <p className="mt-1 text-xs text-slate-400">Discovering openings across Indeed, Reed, NHS Jobs, and LinkedIn</p>
          </div>
        ) : displayedSuggestions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xs border border-dashed border-slate-300 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl">
              🎯
            </div>
            <h3 className="text-lg font-bold text-slate-900">No suggestions in view</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Run the AI Role Finder Agent to search for new matching openings for &ldquo;{targetRole}&rdquo; in {targetLocation}.
            </p>
            <button
              onClick={handleTriggerMarketScan}
              disabled={scanning}
              className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
            >
              <span>🤖</span> {scanning ? "Scanning Live Market..." : "Run AI Job Finder Now"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedSuggestions.map((job) => {
              const matchPercent = Math.round(job.match_score)
              const isHighMatch = matchPercent >= 85
              const isMedMatch = matchPercent >= 70

              return (
                <div
                  key={job.id}
                  className="group bg-white rounded-2xl shadow-xs border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 p-6 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title + Match Badge */}
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {job.job_title}
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                          <span>🏢</span>
                          <span className="truncate">{job.company_name}</span>
                        </p>
                      </div>

                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-xs ${
                          isHighMatch
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : isMedMatch
                            ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        <span>{isHighMatch ? "🔥" : "✨"}</span>
                        <span>{matchPercent}%</span>
                      </div>
                    </div>

                    {/* Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
                      {job.location && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                          <span>📍</span> {job.location}
                        </span>
                      )}

                      {job.salary_min ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100">
                          <span>💰</span>
                          £{job.salary_min.toLocaleString()}
                          {job.salary_max ? ` - £${job.salary_max.toLocaleString()}` : "+"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 text-slate-600 font-medium">
                          Competitive Salary
                        </span>
                      )}

                      {job.easy_apply && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100">
                          ⚡ Easy Apply
                        </span>
                      )}

                      {job.source_site && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[11px] font-medium border border-slate-100">
                          {job.source_site}
                        </span>
                      )}
                    </div>

                    {/* Description preview */}
                    {job.description && (
                      <p className="text-xs text-slate-600 line-clamp-3 mb-5 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {job.description}
                      </p>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleDismiss(job.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1.5 transition-colors"
                      title="Dismiss suggestion"
                    >
                      Dismiss
                    </button>

                    <div className="flex items-center gap-2">
                      {job.job_url && (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          View ↗
                        </a>
                      )}
                      <button
                        onClick={() => handleApplyToJob(job)}
                        disabled={actionInProgress === job.id}
                        className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-xl shadow-xs hover:shadow-md transition-all disabled:opacity-50"
                      >
                        {actionInProgress === job.id ? (
                          <>
                            <span className="animate-spin text-[10px]">🔄</span> Adding...
                          </>
                        ) : (
                          <>+ Add to Pipeline</>
                        )}
                      </button>
                    </div>
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
