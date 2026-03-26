"use client"

import { useState } from "react"
import { EmailCredentials } from "@/types"

interface EmailConfigProps {
  credentials: EmailCredentials[]
  onSave: (provider: string, config: any) => Promise<void>
  onDelete: (provider: string) => Promise<void>
  loading?: boolean
  userId?: string
}

export function EmailConfig({ credentials, onSave, onDelete, loading = false, userId }: EmailConfigProps) {
  const [activeTab, setActiveTab] = useState<"gmail" | "smtp">("gmail")
  const [smtpConfig, setSmtpConfig] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    use_tls: true,
  })
  const [gmailAuthUrl, setGmailAuthUrl] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")

  const gmailCredential = credentials.find((c) => c.provider === "gmail")
  const smtpCredential = credentials.find((c) => c.provider === "smtp")

  // Generate Gmail OAuth URL
  const generateGmailAuthUrl = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
    const redirectUri = `${window.location.origin}/api/auth/google/callback`
    // Include both gmail and email scopes
    const scope = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email"

    // Encode userId in state parameter (base64)
    const state = userId ? btoa(userId) : ""

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${state}`
    return authUrl
  }

  const handleGmailConnect = () => {
    const authUrl = generateGmailAuthUrl()
    window.location.href = authUrl
  }

  const handleSmtpChange = (field: string, value: any) => {
    setSmtpConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSmtpSave = async () => {
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
      setError("All SMTP fields are required")
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      await onSave("smtp", smtpConfig)
      setSuccess("SMTP configuration saved successfully!")
      setSmtpConfig({ host: "", port: 587, username: "", password: "", use_tls: true })
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (provider: string) => {
    if (confirm(`Are you sure you want to disconnect ${provider.toUpperCase()}?`)) {
      try {
        await onDelete(provider)
        setSuccess(`${provider.toUpperCase()} disconnected successfully`)
      } catch (err) {
        setError(String(err))
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Email Connection</h2>
        <p className="mt-2 text-gray-600">
          Connect your email to automatically track job applications. Choose Gmail OAuth (recommended) or SMTP.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab("gmail")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "gmail"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Gmail OAuth
        </button>
        <button
          onClick={() => setActiveTab("smtp")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "smtp"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          SMTP Configuration
        </button>
      </div>

      {/* Gmail Tab */}
      {activeTab === "gmail" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {gmailCredential && gmailCredential.is_connected ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">✓ Gmail Connected</p>
                <p className="text-sm text-green-700 mt-1">{gmailCredential.email_address}</p>
                {gmailCredential.last_verified_at && (
                  <p className="text-xs text-green-600 mt-2">
                    Last verified: {new Date(gmailCredential.last_verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete("gmail")}
                className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Disconnect Gmail
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900">How it works:</h3>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>✓ Read-only access to your emails</li>
                  <li>✓ Automatically detects job-related emails</li>
                  <li>✓ Secure OAuth authentication</li>
                  <li>✓ No password stored</li>
                </ul>
              </div>
              <button
                onClick={handleGmailConnect}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                Connect with Gmail
              </button>
            </div>
          )}
        </div>
      )}

      {/* SMTP Tab */}
      {activeTab === "smtp" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {smtpCredential && smtpCredential.is_connected ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">✓ SMTP Connected</p>
                <p className="text-sm text-green-700 mt-1">{smtpCredential.email_address}</p>
                {smtpCredential.last_verified_at && (
                  <p className="text-xs text-green-600 mt-2">
                    Last verified: {new Date(smtpCredential.last_verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete("smtp")}
                className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Disconnect SMTP
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="font-medium text-amber-900">SMTP Configuration</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Enter your email provider's SMTP settings. Common providers:
                </p>
                <ul className="text-sm text-amber-600 mt-2 space-y-1 ml-4">
                  <li>• Gmail: smtp.gmail.com:587</li>
                  <li>• Outlook: smtp-mail.outlook.com:587</li>
                  <li>• Yahoo: smtp.mail.yahoo.com:587</li>
                </ul>
              </div>

              {/* SMTP Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
                  <input
                    type="text"
                    placeholder="smtp.gmail.com"
                    value={smtpConfig.host}
                    onChange={(e) => handleSmtpChange("host", e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Port</label>
                    <input
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) => handleSmtpChange("port", parseInt(e.target.value))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Use TLS</label>
                    <input
                      type="checkbox"
                      checked={smtpConfig.use_tls}
                      onChange={(e) => handleSmtpChange("use_tls", e.target.checked)}
                      className="mt-3 w-4 h-4 text-indigo-600 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    placeholder="your.email@gmail.com"
                    value={smtpConfig.username}
                    onChange={(e) => handleSmtpChange("username", e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    placeholder="App-specific password"
                    value={smtpConfig.password}
                    onChange={(e) => handleSmtpChange("password", e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For Gmail, use an app-specific password (not your main password)
                  </p>
                </div>
              </div>

              <button
                onClick={handleSmtpSave}
                disabled={saving}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? "Saving..." : "Save SMTP Configuration"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900">Connection Status</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Gmail OAuth:</span>
            <span className={gmailCredential?.is_connected ? "text-green-600 font-medium" : "text-gray-500"}>
              {gmailCredential?.is_connected ? "✓ Connected" : "Not connected"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">SMTP:</span>
            <span className={smtpCredential?.is_connected ? "text-green-600 font-medium" : "text-gray-500"}>
              {smtpCredential?.is_connected ? "✓ Connected" : "Not connected"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
