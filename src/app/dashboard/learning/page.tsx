"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getClientSession } from "@/lib/client-auth"
import { LearningTask } from "@/types"

export default function LearningPage() {
  const [tasks, setTasks] = useState<LearningTask[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [newTitle, setNewTitle] = useState("")
  const [newTopic, setNewTopic] = useState("")
  const [newHours, setNewHours] = useState("3")
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM")
  const [newResource, setNewResource] = useState("")

  const loadTasks = async (uid: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/learning-tasks?userId=${uid}`)
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

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session.userId)
      loadTasks(session.userId)
    })
  }, [])

  const handleToggleTask = async (task: LearningTask, completed: boolean) => {
    // 1. Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed } : t))
    )

    // 2. Persist to API
    try {
      await fetch("/api/learning-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          completed,
        }),
      })
    } catch (err) {
      console.error("Failed to persist task state:", err)
      loadTasks(userId)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle || !userId) return

    try {
      setSubmitting(true)
      const res = await fetch("/api/learning-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          title: newTitle,
          topic: newTopic || null,
          estimated_hours: Number(newHours) || 2,
          priority: newPriority,
          resources: newResource ? [newResource] : [],
        }),
      })

      const data = await res.json()
      if (data.success && data.task) {
        setTasks((prev) => [data.task, ...prev])
        setIsModalOpen(false)
        setNewTitle("")
        setNewTopic("")
        setNewHours("3")
        setNewPriority("MEDIUM")
        setNewResource("")
      }
    } catch (err) {
      console.error("Failed to create task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return !task.completed
    if (filter === "completed") return task.completed
    return true
  })

  const completedCount = tasks.filter((t) => t.completed).length
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Skill Development Plan
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Actionable learning goals mapped directly to missing requirements in your target roles
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              + Add Learning Goal
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-4xl font-extrabold text-indigo-600">{completionRate}%</span>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
                  Overall Completion
                </p>
              </div>
              <div className="h-10 w-px bg-gray-200 hidden sm:block"></div>
              <div>
                <div className="text-base font-bold text-gray-900">
                  {completedCount} of {tasks.length} Goals Achieved
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Keep closing skill gaps to increase interview response rates.
                </p>
              </div>
            </div>

            <div className="w-full md:w-64">
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2">
          {(["all", "pending", "completed"] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === filterOption
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-3 text-sm text-gray-500 font-medium">Loading learning curriculum...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
            <span className="text-4xl">🎓</span>
            <h3 className="mt-3 text-base font-semibold text-gray-900">
              {filter === "completed" ? "No completed tasks yet" : "No learning tasks found"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              The Gap Closer agent will generate tasks based on rejected or high-value job skills.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              + Create Custom Task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-5 rounded-xl border transition-all ${
                  task.completed
                    ? "bg-gray-50/70 border-gray-200 opacity-75"
                    : "bg-white border-gray-200 hover:border-indigo-300 shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => handleToggleTask(task, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={`font-bold text-sm ${
                            task.completed ? "text-gray-400 line-through" : "text-gray-900"
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.topic && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                            {task.topic}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 font-medium">
                        {task.estimated_hours && <span>⏱️ ~{task.estimated_hours} hrs</span>}
                        {task.due_date && <span>📅 Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                      </div>

                      {task.resources && task.resources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100">
                          <p className="text-[11px] font-semibold text-gray-500">Suggested Resources:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {task.resources.map((res, i) => (
                              <span
                                key={i}
                                className="text-xs text-indigo-600 bg-indigo-50/50 px-2.5 py-1 rounded-md"
                              >
                                🔗 {res}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      task.priority === "HIGH"
                        ? "bg-red-100 text-red-700"
                        : task.priority === "MEDIUM"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add Skill Task</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master TypeScript Generics"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Topic / Skill Category</label>
                <input
                  type="text"
                  placeholder="e.g. TypeScript, System Design, GraphQL"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Est. Hours</label>
                  <input
                    type="number"
                    min="1"
                    value={newHours}
                    onChange={(e) => setNewHours(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Resource Link or Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Official Docs or Course link"
                  value={newResource}
                  onChange={(e) => setNewResource(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
