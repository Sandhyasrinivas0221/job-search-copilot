"use client"

import { useEffect, useState } from "react"
import { LearningTask } from "@/types"

export default function LearningPage() {
  const [tasks, setTasks] = useState<LearningTask[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending")

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const userId = urlParams.get("userId") || "demo-user"
    setUserId(userId)

    const fetchTasks = async () => {
      try {
        const res = await fetch(`/api/learning-tasks?userId=${userId}`)
        const data = await res.json()
        if (data.tasks) {
          setTasks(data.tasks)
        }
      } catch (error) {
        console.error("Failed to fetch learning tasks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [])

  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return !task.completed
    if (filter === "completed") return task.completed
    return true
  })

  const completionRate = tasks.length > 0 ? ((tasks.filter((t) => t.completed).length / tasks.length) * 100).toFixed(0) : "0"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading learning tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Learning Plan</h1>
          <p className="mt-2 text-gray-600">Track your skill development</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Overview */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Learning Progress</h2>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-4xl font-bold text-indigo-600">{completionRate}%</p>
              <p className="text-sm text-gray-600 mt-2">Overall completion rate</p>
            </div>
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-indigo-600 h-4 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {tasks.filter((t) => t.completed).length} of {tasks.length} tasks completed
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {(["all", "pending", "completed"] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                filter === filterOption
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {/* Learning Tasks */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-6 rounded-lg border-l-4 ${
                  task.completed
                    ? "bg-green-50 border-green-400"
                    : task.priority === "HIGH"
                    ? "bg-red-50 border-red-400"
                    : task.priority === "MEDIUM"
                    ? "bg-yellow-50 border-yellow-400"
                    : "bg-blue-50 border-blue-400"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-4 flex-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => {
                        // Update task completion
                        setTasks(
                          tasks.map((t) =>
                            t.id === task.id ? { ...t, completed: e.target.checked } : t
                          )
                        )
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3
                        className={`text-lg font-semibold ${
                          task.completed ? "text-gray-500 line-through" : "text-gray-900"
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      task.priority === "HIGH"
                        ? "bg-red-100 text-red-800"
                        : task.priority === "MEDIUM"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 ml-8">
                  {task.topic && <p>📚 {task.topic}</p>}
                  {task.estimated_hours && <p>⏱️ {task.estimated_hours} hours</p>}
                  {task.due_date && (
                    <p>📅 Due: {new Date(task.due_date).toLocaleDateString()}</p>
                  )}
                  {task.resources && task.resources.length > 0 && (
                    <div>
                      <p className="font-medium">Resources:</p>
                      <ul className="list-disc list-inside ml-2">
                        {task.resources.slice(0, 3).map((resource, idx) => (
                          <li key={idx} className="text-xs">
                            {resource}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {filter === "completed"
                ? "No completed tasks yet"
                : "No pending learning tasks"}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
