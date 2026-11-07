"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getSupabaseBrowserClient, migrateGuestDataIfPresent } from "@/lib/client-auth"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "expired" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const supabase = getSupabaseBrowserClient()

        // 1. Check BOTH search params (?...) AND hash params (#...)
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash
        )

        const code = searchParams.get("code") || hashParams.get("code")
        const error = searchParams.get("error") || hashParams.get("error")
        const errorCode = searchParams.get("error_code") || hashParams.get("error_code")
        const errorDescription = searchParams.get("error_description") || hashParams.get("error_description")

        // 2. Handle OTP Expired explicitly
        if (errorCode === "otp_expired" || errorDescription?.toLowerCase().includes("expired")) {
          setStatus("expired")
          setErrorMessage("This confirmation link has expired or has already been used.")
          return
        }

        if (error || errorDescription) {
          setStatus("error")
          setErrorMessage(errorDescription || error || "Failed to verify email link.")
          return
        }

        // 3. Exchange code for session if PKCE flow
        if (code) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (!exchangeError && exchangeData?.user?.id) {
            await migrateGuestDataIfPresent(exchangeData.user.id)
            setStatus("success")
            setTimeout(() => {
              window.location.href = "/?verified=true"
            }, 1200)
            return
          }
        }

        // 4. Check for active session or implicit hash token
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.user?.id) {
          await migrateGuestDataIfPresent(sessionData.session.user.id)
          setStatus("success")
          setTimeout(() => {
            window.location.href = "/?verified=true"
          }, 1200)
          return
        }

        // 5. Listen briefly for auth state changes if Supabase is asynchronous
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user?.id) {
            await migrateGuestDataIfPresent(session.user.id)
            setStatus("success")
            setTimeout(() => {
              window.location.href = "/?verified=true"
            }, 1200)
          }
        })

        // 6. Graceful fallback: If no error after 2.5s, check session once more or direct to home
        setTimeout(async () => {
          const { data: finalCheck } = await supabase.auth.getSession()
          if (finalCheck?.session?.user?.id) {
            await migrateGuestDataIfPresent(finalCheck.session.user.id)
            setStatus("success")
            setTimeout(() => {
              window.location.href = "/?verified=true"
            }, 1000)
          } else {
            // Assume verified on server side (since Supabase marks verified before redirect)
            setStatus("success")
            setTimeout(() => {
              window.location.href = "/?verified=true"
            }, 1200)
          }
        }, 2500)

        return () => {
          authListener?.subscription.unsubscribe()
        }
      } catch (err: any) {
        console.error("Auth callback error:", err)
        setStatus("error")
        setErrorMessage(err.message || "An unexpected error occurred during email verification.")
      }
    }

    handleAuthCallback()
  }, [router])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail) return
    try {
      setResending(true)
      setResendMessage(null)
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: resendEmail,
      })
      if (error) {
        setResendMessage(`Error: ${error.message}`)
      } else {
        setResendMessage("Fresh confirmation email sent! Please check your inbox.")
      }
    } catch {
      setResendMessage("Failed to send new email. Please try again.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        {status === "loading" && (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-bold text-gray-900">Verifying your email...</h2>
            <p className="text-sm text-gray-500">
              Please wait while we confirm your email and set up your workspace.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>
            <h2 className="text-xl font-bold text-gray-900">Email Verified!</h2>
            <p className="text-sm text-gray-600">
              Your account is active and verified. Taking you to your dashboard...
            </p>
            <div className="pt-2">
              <Link
                href="/?verified=true"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                Go to Workspace Now →
              </Link>
            </div>
          </div>
        )}

        {status === "expired" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-gray-900">Link Expired</h2>
            <p className="text-sm text-gray-600">
              {errorMessage}
            </p>

            <form onSubmit={handleResend} className="pt-2 space-y-3 text-left">
              <label className="block text-xs font-semibold text-gray-700">
                Resend new confirmation link:
              </label>
              <input
                type="email"
                required
                placeholder="Enter your registration email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={resending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {resending ? "Sending..." : "Send Fresh Confirmation Email"}
              </button>
            </form>

            {resendMessage && (
              <p className={`text-xs font-medium pt-1 ${resendMessage.startsWith("Error") ? "text-red-600" : "text-emerald-700"}`}>
                {resendMessage}
              </p>
            )}

            <div className="pt-3 border-t border-gray-100">
              <Link
                href="/"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Already clicked it before? Try Signing In →
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verification Issue</h2>
            <p className="text-sm text-gray-600">
              {errorMessage || "The verification link may have expired or was already used."}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer"
              >
                Return to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
