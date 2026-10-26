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
    name: "Skill Market Scanner Agent",
    description: "Extract required skills and identify market trends",
    schedule: "Daily at 8 AM",
    enabled: true,
    sealedAbilities: {
      canRead: ["job_descriptions"],
      canWrite: ["skill_demand"],
      cannot: ["modify_applications"],
    },
  },
  {
    id: "workflow-gap-closer",
    name: "Skill Gap Closer Agent",
    description: "Create personalized learning curriculum for skill gaps",
    schedule: "Daily at 8:30 AM",
    enabled: true,
    sealedAbilities: {
      canRead: ["user_skills", "skill_demand"],
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

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
        )

        const {
          data: { user },
        } = await supabase.auth.getUser()

        const uid =
          user?.id ||
          process.env.NEXT_PUBLIC_TEST_USER_ID ||
          "00000000-0000-0000-0000-000000000001"

        setUserId(uid)
        fetchEmailCredentials(uid)

        // Read URL query parameters
        const urlParams = new URLSearchParams(window.location.search)
        const success = urlParams.get("success")
        const error = urlParams.get("error")
        const tab = urlParams.get("tab")

        if (tab === "email" || success === "true") {
          setActiveTab("email")
          setTimeout(() => {
            fetchEmailCredentials(uid)
          }, 300)
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
      }
    } catch (error) {
      console.error("Failed to save email credentials:", error)
    }
  }

  const handleEmailDelete = async (provider: string) => {
    try {
      const res = await fetch(
        `/api/email/credentials?userId=${userId}&provider=${provider}`,
        { method: "DELETE" }
      )

      const data = await res.json()
      if (data.success) {
        fetchEmailCredentials(userId)
      }
    } catch (error) {
      console.error("Failed to delete email credentials:", error)
    }
  }

  const toggleAgent = (agentId: string) => {
    setAgents(
      agents.map((agent) =>
        agent.id === agentId ? { ...agent, enabled: !agent.enabled } : agent
      )
    )
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      alert("Agent settings saved successfully!")
    } catch (error) {
      console.error("Failed to save settings:", error)
      alert("Failed to save settings")
    } finally {
      setLoading(false)
    }
  }

  const gmailCredential = emailCredentials.find(
    (c) => c.provider === "gmail" && c.is_connected
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Settings & Integrations
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure your background AI agents and connected email inboxes
              </p>
            </div>
            {gmailCredential && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                Gmail: {gmailCredential.email_address}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Notice */}
        {gmailCredential && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📬</span>
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  Gmail Connected & Monitored
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Inbox <strong>{gmailCredential.email_address}</strong> is active. The Mail Listener Agent scans your job application updates every 5 minutes.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("email")}
              className="text-xs font-bold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Manage Connection →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === "agents"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Agent Workflows (6)
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "email"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>Email Connection</span>
            {gmailCredential && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>

        {/* Agents Tab */}
        {activeTab === "agents" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={() => toggleAgent(agent.id)}
                  connectedEmail={
                    agent.id === "workflow-mail-listener"
                      ? gmailCredential?.email_address
                      : undefined
                  }
                />
              ))}
            </div>

            <div className="flex justify-end pt-6 border-t">
              <button
                onClick={saveSettings}
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
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
  connectedEmail?: string
}

function AgentCard({ agent, onToggle, connectedEmail }: AgentCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900">{agent.name}</h3>
              {connectedEmail && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ✓ {connectedEmail}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              {agent.description}
            </p>
          </div>
          <button
            onClick={onToggle}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              agent.enabled
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {agent.enabled ? "Active" : "Disabled"}
          </button>
        </div>

        <div className="space-y-3 pt-3 border-t border-gray-100 text-xs">
          <div>
            <span className="font-semibold text-gray-700">Schedule: </span>
            <span className="text-gray-500 font-medium">{agent.schedule}</span>
          </div>

          <div>
            <p className="font-semibold text-gray-700 mb-1.5">Permissions & Scopes:</p>
            <div className="space-y-1 ml-1 text-[11px]">
              <div>
                <span className="text-emerald-600 font-semibold">Reads:</span>
                <span className="text-gray-600 ml-1.5">
                  {agent.sealedAbilities.canRead.join(", ")}
                </span>
              </div>
              <div>
                <span className="text-indigo-600 font-semibold">Writes:</span>
                <span className="text-gray-600 ml-1.5">
                  {agent.sealedAbilities.canWrite.join(", ")}
                </span>
              </div>
              <div>
                <span className="text-red-500 font-semibold">Restricted:</span>
                <span className="text-gray-400 ml-1.5">
                  {agent.sealedAbilities.cannot.join(", ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
