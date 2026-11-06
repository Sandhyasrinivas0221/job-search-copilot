"use client"

import { useState } from "react"
import { signInWithEmail, signUpWithEmail } from "@/lib/client-auth"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  currentUserId?: string
}

export function AuthModal({ isOpen, onClose, currentUserId }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConfirmationSent, setIsConfirmationSent] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Please enter your email address.")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setMessage(null)

      if (mode === "signup") {
        if (!password || password.length < 6) {
          setError("Password must be at least 6 characters.")
          return
        }
        const res = await signUpWithEmail(email, password)
        if (res.success) {
          // Dedicated persistent confirmation screen
          setIsConfirmationSent(true)
        } else {
          setError(res.error || "Failed to create account.")
        }
      } else {
        const res = await signInWithEmail(email, password || undefined)
        if (res.success) {
          setMessage("Successfully signed in! Loading your workspace...")
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          setError(res.error || "Failed to sign in. Please verify your credentials.")
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  // Persistent "Check Your Email" View after Sign-Up
  if (isConfirmationSent) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={() => {
              setIsConfirmationSent(false)
              setMode("signin")
              onClose()
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>

          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl mx-auto mb-4">
            ✉️
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h2>
          <p className="text-sm text-gray-600 mb-4">
            We have sent an activation link to <strong className="text-indigo-600">{email}</strong>.
          </p>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 mb-6 text-left space-y-1.5 leading-relaxed">
            <p className="font-bold text-blue-950 flex items-center gap-1.5">
              <span>ℹ️</span> Next steps to activate:
            </p>
            <p>1. Open your email inbox and look for the confirmation email.</p>
            <p>2. Click the confirmation link to activate your private account.</p>
            <p>3. Return here and sign in with your email and password.</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                setIsConfirmationSent(false)
                setMode("signin")
                setError(null)
              }}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
            >
              Sign In to Your Account
            </button>
            <button
              onClick={() => {
                setIsConfirmationSent(false)
                onClose()
              }}
              className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative border border-gray-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">
            👤
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "signin" ? "Sign In to Your Workspace" : "Create Private Account"}
            </h2>
            <p className="text-xs text-gray-500">
              Each user has their own isolated applications, jobs, and learning paths
            </p>
          </div>
        </div>

        {currentUserId && (
          <div className="mb-4 p-2.5 bg-gray-50 rounded-lg text-[11px] text-gray-500 font-mono">
            Current Workspace ID: {currentUserId}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium">
            ✅ {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. you@example.com"
              className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Password {mode === "signin" && <span className="text-gray-400 font-normal">(Optional for Magic Link)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Password (or leave blank for magic link)"}
              className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Processing..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>

          <div className="pt-2 text-center text-xs text-gray-500">
            {mode === "signin" ? (
              <p>
                Don't have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup")
                    setError(null)
                  }}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  Create one
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin")
                    setError(null)
                  }}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
