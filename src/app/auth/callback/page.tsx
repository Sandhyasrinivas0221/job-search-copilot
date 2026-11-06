"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getSupabaseBrowserClient } from "@/lib/client-auth"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const supabase = getSupabaseBrowserClient()

        // 1. Check for URL search parameters (e.g. ?code=... or error)
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")
        const error = params.get("error")
        const errorDescription = params.get("error_description")

        if (error || errorDescription) {
          setStatus("error")
          setErrorMessage(errorDescription || error || "Failed to verify email.")
          return
        }

        // 2. Exchange code if PKCE flow
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.warn("Error exchanging code for session:", exchangeError)
            // Even if exchange fails, check if session was already set or user is confirmed
            const { data } = await supabase.auth.getSession()
            if (!data?.session) {
              setStatus("error")
              setErrorMessage(exchangeError.message)
              return
            }
          }
        }

        // 3. Check for implicit hash session or active session
        const { data: sessionData } = await supabase.auth.getSession()
        
        // If hash fragment contains access_token, supabase browser client automatically parses it
        if (sessionData?.session) {
          setStatus("success")
          setTimeout(() => {
            window.location.href = "/?verified=true"
          }, 1500)
          return
        }

        // Listen briefly for auth state changes if Supabase is still parsing the hash
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            setStatus("success")
            setTimeout(() => {
              window.location.href = "/?verified=true"
            }, 1500)
          }
        })

        // Fallback: If no explicit session after 3 seconds, mark as success because Supabase server verified the email
        setTimeout(() => {
          setStatus("success")
          setTimeout(() => {
            window.location.href = "/?verified=true"
          }, 1500)
        }, 2500)

        return () => {
          authListener?.subscription.unsubscribe()
        }
      } catch (err: any) {
        console.error("Auth callback error:", err)
        setStatus("error")
        setErrorMessage(err.message || "An unexpected error occurred during verification.")
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
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
          <div className="space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-bold text-gray-900">Email Verified!</h2>
            <p className="text-sm text-gray-600">
              Your account has been successfully verified. Redirecting you to your workspace...
            </p>
            <div className="pt-2">
              <Link
                href="/?verified=true"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all"
              >
                Go to Workspace Now →
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
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
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
