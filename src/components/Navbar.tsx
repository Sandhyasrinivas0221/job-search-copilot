"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { getClientSession, signOutUser, ClientUserSession, getAuthHeaders, getSupabaseBrowserClient, migrateGuestDataIfPresent } from "@/lib/client-auth"
import { AuthModal } from "@/components/AuthModal"

export function Navbar() {
  const pathname = usePathname()
  const [session, setSession] = useState<ClientUserSession | null>(null)
  const [connectedGmail, setConnectedGmail] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [verifiedBanner, setVerifiedBanner] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.search.includes("verified=true")) {
        setVerifiedBanner(true)
        sessionStorage.removeItem("pending_verification_email")
        setPendingVerificationEmail(null)
        const timer = setTimeout(() => setVerifiedBanner(false), 8000)
        return () => clearTimeout(timer)
      }
      const savedPending = sessionStorage.getItem("pending_verification_email")
      if (savedPending) {
        setPendingVerificationEmail(savedPending)
      }
    }
  }, [])

  useEffect(() => {
    const refreshSession = () => {
      getClientSession().then(async (s) => {
        setSession(s)
        if (s?.userId && !s.isDemo) {
          // Verified account signed in — clear any pending verification prompt
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("pending_verification_email")
          }
          setPendingVerificationEmail(null)
          // If user is authenticated, migrate any residual guest data
          await migrateGuestDataIfPresent(s.userId)
        }
        if (s?.userId) {
          const authHeaders = await getAuthHeaders()
          fetch(`/api/email/credentials?userId=${s.userId}`, { headers: authHeaders })
            .then((r) => r.json())
            .then((data) => {
              const gmail = data.credentials?.find(
                (c: any) => c.provider === "gmail" && c.is_connected
              )
              if (gmail) {
                setConnectedGmail(gmail.email_address)
              }
            })
            .catch(() => {})
        }
      })
    }

    refreshSession()

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: authListener } = supabase.auth.onAuthStateChange(() => {
        refreshSession()
      })
      return () => {
        authListener?.subscription.unsubscribe()
      }
    } catch {
      // Supabase credentials not set or browser offline
    }
  }, [])

  const handleSyncInbox = async () => {
    if (!session?.userId || syncing) return
    try {
      setSyncing(true)
      setSyncMessage("Syncing...")
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/agents/sync-inbox?userId=${session.userId}`, {
        method: "POST",
        headers: authHeaders,
      })
      const data = await res.json()
      if (data.success) {
        const count = data.parsedApplicationsCount || 0
        setSyncMessage(`Synced ${count} jobs!`)
        setTimeout(() => {
          setSyncMessage(null)
          // Refresh window if on applications or pipeline page
          if (pathname.includes("/dashboard/applications") || pathname.includes("/dashboard/pipeline") || pathname === "/") {
            window.location.reload()
          }
        }, 2000)
      } else {
        setSyncMessage(data.message || "No new emails")
        setTimeout(() => setSyncMessage(null), 3000)
      }
    } catch {
      setSyncMessage("Sync failed")
      setTimeout(() => setSyncMessage(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const navItems = [
    { label: "Overview", href: "/" },
    { label: "Applications", href: "/dashboard/applications" },
    { label: "Pipeline", href: "/dashboard/pipeline" },
    { label: "Suggestions", href: "/dashboard/suggestions" },
    { label: "Learning", href: "/dashboard/learning" },
    { label: "Metrics", href: "/dashboard/metrics" },
    { label: "Settings", href: "/dashboard/settings" },
  ]

  return (
    <>
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl">🚀</span>
              <span className="font-bold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">
                Job Search Copilot
              </span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connectedGmail && (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/settings?tab=email"
                  className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  title="Gmail connected and monitored"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  {connectedGmail}
                </Link>

                <button
                  onClick={handleSyncInbox}
                  disabled={syncing}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                  title="Sync Gmail inbox for new job applications and status updates"
                >
                  <span className={`mr-1.5 ${syncing ? "animate-spin" : ""}`}>🔄</span>
                  {syncMessage || (syncing ? "Syncing..." : "Sync Inbox")}
                </button>
              </div>
            )}

            {session && (
              <div className="flex items-center gap-2">
                {session.isDemo ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                      title={`Private Guest Session: ${session.userId}`}
                    >
                      Guest Workspace
                    </span>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                    >
                      Sign In / Register
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                      {session.user?.email || "Account"}
                    </span>
                    <button
                      onClick={() => signOutUser()}
                      className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200"
                      title="Sign out of session"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {verifiedBanner && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-inner">
          <span>✅</span>
          <span>Your email has been verified! You are now logged into your workspace.</span>
          <button
            onClick={() => setVerifiedBanner(false)}
            className="ml-3 text-emerald-200 hover:text-white font-bold"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}

      {pendingVerificationEmail && !verifiedBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-inner">
          <span>✉️</span>
          <span>
            Check your email: we sent a confirmation link to <strong>{pendingVerificationEmail}</strong>. Please click it to verify your account.
          </span>
          <button
            onClick={() => {
              setPendingVerificationEmail(null)
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("pending_verification_email")
              }
            }}
            className="ml-3 text-indigo-200 hover:text-white font-bold"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}
    </nav>

    <AuthModal
      isOpen={isAuthModalOpen}
      onClose={() => setIsAuthModalOpen(false)}
      currentUserId={session?.userId}
      onConfirmationEmailSent={(sentEmail) => {
        setPendingVerificationEmail(sentEmail)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pending_verification_email", sentEmail)
        }
      }}
    />
    </>
  )
}
