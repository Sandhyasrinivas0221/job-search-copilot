"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { getClientSession, signOutUser, ClientUserSession } from "@/lib/client-auth"

export function Navbar() {
  const pathname = usePathname()
  const [session, setSession] = useState<ClientUserSession | null>(null)
  const [connectedGmail, setConnectedGmail] = useState<string | null>(null)

  useEffect(() => {
    getClientSession().then((s) => {
      setSession(s)
      if (s?.userId) {
        fetch(`/api/email/credentials?userId=${s.userId}`)
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
  }, [])

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
              <Link
                href="/dashboard/settings?tab=email"
                className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Gmail connected and monitored"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                {connectedGmail}
              </Link>
            )}

            {session && (
              <div className="flex items-center gap-2">
                {session.isDemo ? (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                    title={`Active User ID: ${session.userId}`}
                  >
                    Demo Workspace
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                    {session.user?.email || "Connected"}
                  </span>
                )}

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
        </div>
      </div>
    </nav>
  )
}
