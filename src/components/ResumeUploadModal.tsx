"use client"

import { useState } from "react"
import { getAuthHeaders } from "@/lib/client-auth"

interface ResumeUploadModalProps {
  userId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ResumeUploadModal({
  userId,
  isOpen,
  onClose,
  onSuccess,
}: ResumeUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [textInput, setTextInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const [syncingInbox, setSyncingInbox] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleUpload = async () => {
    if (!file && (!textInput || textInput.trim().length < 20)) {
      setError("Please select a resume file (PDF/TXT) or paste your resume text.")
      return
    }

    try {
      setUploading(true)
      setError(null)
      setResultMessage(null)
      setSyncResult(null)

      let res: Response
      const authHeaders = await getAuthHeaders()
      if (file) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("userId", userId)
        res = await fetch("/api/user/resume-upload", {
          method: "POST",
          headers: authHeaders,
          body: formData,
        })
      } else {
        res = await fetch("/api/user/resume-upload", {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, text: textInput }),
        })
      }

      const data = await res.json()
      if (res.ok && data.success) {
        setParsedData(data.extracted)
        setResultMessage("Resume successfully parsed and career profile updated!")
      } else {
        setError(data.error || "Failed to parse resume.")
      }
    } catch (err) {
      setError("An unexpected error occurred during resume processing.")
    } finally {
      setUploading(false)
    }
  }

  const handleSyncInbox = async () => {
    try {
      setSyncingInbox(true)
      setSyncResult(null)
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/agents/sync-inbox?userId=${userId}`, {
        headers: authHeaders,
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const count = data.applications?.length || 0
        setSyncResult(`Successfully scanned inbox! Found ${count} applications for ${parsedData?.target_role || "your role"}.`)
      } else {
        setSyncResult(data.message || "Inbox scanned. Connect your Gmail in Settings if you haven't yet.")
      }
    } catch (err) {
      setSyncResult("Inbox sync finished. Check the dashboard pipeline.")
    } finally {
      setSyncingInbox(false)
    }
  }

  const handleDone = () => {
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative border border-gray-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">
            📄
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Upload & Parse Resume</h2>
            <p className="text-xs text-gray-500">
              Universal agent parser for Care, Healthcare, Tech, Education & all fields
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {resultMessage && parsedData && (
          <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 text-sm">✅ Profile Extracted Successfully</span>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 font-semibold rounded-full text-[10px]">
                {parsedData.industry_field}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-gray-700 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Target Role</span>
                <span className="font-semibold text-gray-900">{parsedData.target_role}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Location</span>
                <span className="font-semibold text-gray-900">{parsedData.target_location}</span>
              </div>
            </div>

            {parsedData.skills && parsedData.skills.length > 0 && (
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">
                  Extracted Skills ({parsedData.skills.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {parsedData.skills.slice(0, 8).map((sk: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-medium border border-indigo-100">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {parsedData.search_keywords && parsedData.search_keywords.length > 0 && (
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">
                  Inbox Search Keywords ({parsedData.search_keywords.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {parsedData.search_keywords.slice(0, 6).map((kw: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md text-[11px] font-medium border border-amber-200">
                      🔍 {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {syncResult && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-lg font-medium">
                📬 {syncResult}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSyncInbox}
                disabled={syncingInbox}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {syncingInbox ? "🔄 Syncing Inbox..." : "🔄 Sync Inbox for This Profile"}
              </button>
              <button
                onClick={handleDone}
                className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
              >
                Done & View Dashboard
              </button>
            </div>
          </div>
        )}

        {!parsedData && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select Resume File (.pdf, .txt, .docx)
              </label>
              <input
                type="file"
                accept=".pdf,.txt,.docx,.doc"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setFile(f)
                }}
                className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-gray-300 rounded-lg p-2"
              />
              {file && (
                <p className="mt-1 text-xs text-gray-500 font-medium">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-[11px] text-gray-400 uppercase font-semibold">
                Or paste text
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div>
              <textarea
                rows={4}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your CV / resume text or care experience here..."
                className="w-full p-2.5 text-xs text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <span className="animate-spin">🔄</span> Parsing Skills...
                  </>
                ) : (
                  "Save & Extract Profile"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
