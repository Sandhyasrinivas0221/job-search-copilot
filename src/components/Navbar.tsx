"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  getClientSession,
  signOutUser,
  ClientUserSession,
  getAuthHeaders,
  getSupabaseBrowserClient,
  migrateGuestDataIfPresent,
} from "@/lib/client-auth"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          if (
            pathname.includes("/dashboard/applications") ||
            pathname.includes("/dashboard/pipeline") ||
            pathname === "/"
          ) {
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
    { label: "Overview", href: "/", icon: "📊" },
    { label: "Applications", href: "/dashboard/applications", icon: "📝" },
    { label: "Pipeline", href: "/dashboard/pipeline", icon: "📌" },
    { label: "Suggestions", href: "/dashboard/suggestions", icon: "🎯", badge: "AI" },
    { label: "Learning", href: "/dashboard/learning", icon: "💡" },
    { label: "Metrics", href: "/dashboard/metrics", icon: "📈" },
    { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
  ]

  const userInitial = session?.user?.email ? session.user.email[0].toUpperCase() : "U"

  return (
    <>
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Brand Identity */}
            <div className="flex items-center gap-6 lg:gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                {/* Brand Rocket Icon */}
                <span className="text-2xl sm:text-3xl transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5">
                  🚀
                </span>

                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                        Job Search
                      </span>
                      <span className="font-black text-base sm:text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-500 bg-clip-text text-transparent leading-none">
                        Copilot
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Center Navigation (Desktop) */}
              <div className="hidden md:flex space-x-1 items-center">
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-100"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-extrabold uppercase bg-purple-100 text-purple-700 px-1 py-0.2 rounded font-mono">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right: Actions, Gmail & Account Status */}
            <div className="flex items-center gap-2 sm:gap-3">
              {connectedGmail && (
                <div className="flex items-center gap-2">
                  <Link
                    href="/dashboard/settings?tab=email"
                    className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    title="Gmail connected and monitored"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                    <span className="max-w-[130px] truncate">{connectedGmail}</span>
                  </Link>

                  <button
                    onClick={handleSyncInbox}
                    disabled={syncing}
                    className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/70 transition-all disabled:opacity-50"
                    title="Sync Gmail inbox for new job applications and status updates"
                  >
                    <span className={`mr-1.5 ${syncing ? "animate-spin" : ""}`}>🔄</span>
                    <span className="hidden sm:inline">
                      {syncMessage || (syncing ? "Syncing..." : "Sync Inbox")}
                    </span>
                  </button>
                </div>
              )}

              {/* User Account Controls */}
              {session && (
                <div className="flex items-center gap-2">
                  {session.isDemo ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80"
                        title={`Guest Session: ${session.userId}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Guest Mode
                      </span>
                      <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-xs hover:shadow-md transition-all"
                      >
                        <span>✨</span>
                        <span>Sign In / Register</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Authenticated User Pill */}
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 shadow-xs">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                          {userInitial}
                        </div>
                        <span className="hidden sm:inline text-xs font-semibold text-slate-800 max-w-[140px] truncate">
                          {session.user?.email || "Account"}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Verified Session"></span>
                      </div>

                      <button
                        onClick={() => signOutUser()}
                        className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200"
                        title="Sign out of account"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Menu Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <span className="text-xl leading-none">✕</span>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 px-4 pt-2 pb-4 space-y-1 shadow-lg animate-in slide-in-from-top-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Email Verification Success Banner */}
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

        {/* Check Your Email Verification Banner */}
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
