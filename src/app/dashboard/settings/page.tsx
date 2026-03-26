"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { EmailConfig } from "@/components/EmailConfig"
import { EmailCredentials } from "@/types"

interface Agent {
  id: string
  name: string
  description: string
  schedule: string
  enabled: boolean
  sealedAbilities: {
    canRead: string[]
    canWrite: string[]
    cannot: string[]
  }
}

const AGENTS: Agent[] = [
  {
    id: "workflow-mail-listener",
    name: "Mail Listener Agent",
    description: "Monitor inbox for application status changes",
    schedule: "Every 5 minutes",
    enabled: true,
    sealedAbilities: {
      canRead: ["emails"],
      canWrite: ["applications", "status_history"],
      cannot: ["send_emails", "apply_to_jobs"],
    },
  },
  {
    id: "workflow-tracker",
    name: "Pipeline Tracker Agent",
    description: "Update application pipeline and follow-ups",
    schedule: "Every 10 minutes",
    enabled: true,
    sealedAbilities: {
      canRead: ["applications"],
      canWrite: ["applications", "status_history"],
      cannot: ["send_emails", "access_emails"],
    },
  },
  {
    id: "workflow-role-finder",
    name: "Job Role Finder Agent",
    description: "Search for job opportunities across platforms",
    schedule: "Hourly",
    enabled: true,
    sealedAbilities: {
      canRead: ["user_profile"],
      canWrite: ["job_suggestions"],
      cannot: ["apply_to_jobs", "send_emails"],
    },
  },
  {
    id: "workflow-market-scanner",
    name: "Market Scanner Agent",
    description: "Analyze market trends and in-demand skills",
    schedule: "Daily at 11 AM",
    enabled: true,
    sealedAbilities: {
      canRead: ["job_listings"],
      canWrite: ["skill_demand"],
      cannot: ["modify_applications", "send_emails"],
    },
  },
  {
    id: "workflow-gap-closer",
    name: "Learning Gap Closer Agent",
    description: "Generate personalized learning plans",
    schedule: "Daily at 8 AM",
    enabled: true,
    sealedAbilities: {
      canRead: ["skill_demand", "applications"],
      canWrite: ["learning_tasks"],
      cannot: ["apply_to_jobs", "send_emails"],
    },
  },
  {
    id: "workflow-metrics-reporter",
    name: "Metrics Reporter Agent",
    description: "Send daily job recommendations email",
    schedule: "Daily at 9 AM",
    enabled: true,
    sealedAbilities: {
      canRead: ["applications", "job_suggestions"],
      canWrite: ["email_logs"],
      cannot: ["modify_data"],
    },
  },
]

export default function SettingsPage() {
  const [agents, setAgents] = useState<Agent[]>(AGENTS)
  const [loading, setLoading] = useState(false)
  const [emailCredentials, setEmailCredentials] = useState<EmailCredentials[]>([])
  const [activeTab, setActiveTab] = useState<"agents" | "email">("agents")
  const [userId, setUserId] = useState("")

  // Fetch user ID and email credentials on mount
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
        )

        // Get the authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        let uid: string
        if (user?.id) {
          uid = user.id
        } else {
          // Fallback for development: use a test UUID
          uid = "00000000-0000-0000-0000-000000000001"
          console.warn(
            "No authenticated user found. Using test UUID for development. Please authenticate first."
          )
        }

        setUserId(uid)
        fetchEmailCredentials(uid)

        // Check if we're coming back from OAuth success
        const urlParams = new URLSearchParams(window.location.search)
        const success = urlParams.get("success")
        const error = urlParams.get("error")

        if (success === "true") {
          console.log("[settings] OAuth completion detected, refetching credentials")
          setActiveTab("email")
          // Refetch after OAuth redirect
          setTimeout(() => {
            fetchEmailCredentials(uid)
          }, 500)
        }

        if (error) {
          console.error("[settings] OAuth error:", error)
          alert(`Email connection failed: ${error}`)
        }
      } catch (error) {
        console.error("Failed to initialize user:", error)
      }
    }

    initializeUser()
  }, [])

  const fetchEmailCredentials = async (uid: string) => {
    try {
      const res = await fetch(`/api/email/credentials?userId=${uid}`)
      const data = await res.json()
      if (data.success) {
        setEmailCredentials(data.credentials || [])
      }
    } catch (error) {
      console.error("Failed to fetch email credentials:", error)
    }
  }

  const handleEmailSave = async (provider: string, config: any) => {
    try {
      const res = await fetch("/api/email/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          provider,
          email_address: config.username || config.email_address,
          [provider === "gmail" ? "gmail_config" : "smtp_config"]: config,
        }),
      })
      const data = await res.json()
      if (data.success) {
        fetchEmailCredentials(userId)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      throw error
    }
  }

  const handleEmailDelete = async (provider: string) => {
    try {
      const res = await fetch(`/api/email/credentials?userId=${userId}&provider=${provider}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        fetchEmailCredentials(userId)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      throw error
    }
  }

  const toggleAgent = (id: string) => {
    setAgents((prevAgents) =>
      prevAgents.map((agent) =>
        agent.id === id ? { ...agent, enabled: !agent.enabled } : agent
      )
    )
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      // Save settings to backend (if needed)
      console.log("Settings saved:", agents)
      alert("Agent settings saved successfully!")
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Failed to save settings")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to home"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Settings</h1>
              <p className="mt-2 text-gray-600">
                Configure your AI agents and their permissions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tabs */}
        <div className="flex gap-4 border-b mb-8">
          <button
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "agents"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Agent Configuration
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "email"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Email Connection
          </button>
        </div>

        {/* Agents Tab */}
        {activeTab === "agents" && (
          <div className="space-y-6">
            {/* Agents Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={() => toggleAgent(agent.id)}
                />
              ))}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t">
              <button
                onClick={saveSettings}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === "email" && (
          <EmailConfig
            credentials={emailCredentials}
            onSave={handleEmailSave}
            onDelete={handleEmailDelete}
            loading={loading}
            userId={userId}
          />
        )}
      </main>
    </div>
  )
}

interface AgentCardProps {
  agent: Agent
  onToggle: () => void
}

function AgentCard({ agent, onToggle }: AgentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
          <p className="mt-1 text-sm text-gray-600">{agent.description}</p>
        </div>
        <button
          onClick={onToggle}
          className={`ml-4 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            agent.enabled
              ? "bg-green-100 text-green-800 hover:bg-green-200"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
          }`}
        >
          {agent.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="text-sm">
          <p className="font-medium text-gray-700 mb-1">Schedule:</p>
          <p className="text-gray-600">{agent.schedule}</p>
        </div>

        <div className="text-sm">
          <p className="font-medium text-gray-700 mb-2">Sealed Abilities:</p>
          <div className="space-y-1 ml-2">
            <div>
              <span className="text-green-600 font-medium">Can read:</span>
              <span className="text-gray-600 ml-2">
                {agent.sealedAbilities.canRead.join(", ")}
              </span>
            </div>
            <div>
              <span className="text-blue-600 font-medium">Can write:</span>
              <span className="text-gray-600 ml-2">
                {agent.sealedAbilities.canWrite.join(", ")}
              </span>
            </div>
            <div>
              <span className="text-red-600 font-medium">Cannot:</span>
              <span className="text-gray-600 ml-2">
                {agent.sealedAbilities.cannot.join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
