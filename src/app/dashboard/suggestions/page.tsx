"use client"

import { useEffect, useState } from "react"
import { JobSuggestion } from "@/types"

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [easyApplyOnly, setEasyApplyOnly] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const userId = urlParams.get("userId") || "demo-user"
    setUserId(userId)

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/suggestions?userId=${userId}`)
        const data = await res.json()
        if (data.suggestions) {
          setSuggestions(data.suggestions)
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSuggestions()
  }, [])

  const displayedSuggestions = easyApplyOnly
    ? suggestions.filter((s) => s.easy_apply)
    : suggestions

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading job suggestions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Job Suggestions</h1>
          <p className="mt-2 text-gray-600">Roles recommended based on your profile</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setEasyApplyOnly(!easyApplyOnly)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              easyApplyOnly
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300"
            }`}
          >
            Easy Apply Only
          </button>
          <span className="text-sm text-gray-600">
            Showing {displayedSuggestions.length} of {suggestions.length} jobs
          </span>
        </div>

        {/* Job Listings */}
        {displayedSuggestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedSuggestions.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {job.job_title}
                    </h3>
                    <p className="text-sm text-gray-600">{job.company_name}</p>
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      job.match_score >= 75
                        ? "bg-green-100 text-green-800"
                        : job.match_score >= 50
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {job.match_score.toFixed(0)}% match
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {job.location && (
                    <p className="text-sm text-gray-600">📍 {job.location}</p>
                  )}
                  {job.salary_min && job.salary_max && (
                    <p className="text-sm text-gray-600">
                      💰 ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    📊 Source: {job.source_site || "Unknown"}
                  </p>
                </div>

                {job.description && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                    {job.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    {job.easy_apply ? "✨ Easy Apply" : "Submit Manually"}
                  </span>
                  <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  >
                    View Job →
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {easyApplyOnly
                ? "No easy apply jobs found"
                : "No job suggestions yet"}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
