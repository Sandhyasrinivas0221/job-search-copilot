import { createClient } from "@supabase/supabase-js"

export const FALLBACK_TEST_USER_ID =
  process.env.NEXT_PUBLIC_TEST_USER_ID || "00000000-0000-0000-0000-000000000001"

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
  return createClient(url, key)
}

export interface ClientUserSession {
  userId: string
  user: any | null
  isDemo: boolean
}

/**
 * Generate or retrieve an isolated browser UUID for guest visitors.
 */
export function getOrCreateGuestUserId(): string {
  if (typeof window === "undefined") {
    return FALLBACK_TEST_USER_ID
  }
  const STORAGE_KEY = "job_search_copilot_guest_uid"
  let stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      stored = crypto.randomUUID()
    } else {
      stored = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }
    localStorage.setItem(STORAGE_KEY, stored)
  }
  return stored
}

/**
 * Secret token generated for guest visitors to authenticate their requests
 */
export function getOrCreateGuestUserToken(): string {
  if (typeof window === "undefined") {
    return "guest-server-render-token"
  }
  const TOKEN_KEY = "job_search_copilot_guest_token"
  let stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) {
    const array = new Uint8Array(24)
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array)
      stored = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
    } else {
      stored = Math.random().toString(36).substring(2) + Date.now().toString(36)
    }
    localStorage.setItem(TOKEN_KEY, stored)
  }
  return stored
}

/**
 * Returns authentication headers for fetch requests:
 * - Bearer JWT for registered Supabase accounts
 * - X-Guest-Id and X-Guest-Token for guest accounts
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {}
  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) {
      return {
        Authorization: `Bearer ${data.session.access_token}`,
      }
    }
  } catch (e) {
    console.warn("[client-auth] Could not get session token:", e)
  }

  const guestId = getOrCreateGuestUserId()
  const guestToken = getOrCreateGuestUserToken()
  return {
    "X-Guest-Id": guestId,
    "X-Guest-Token": guestToken,
  }
}

export async function getClientSession(): Promise<ClientUserSession> {
  try {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      const guestId = getOrCreateGuestUserId()
      return {
        userId: guestId,
        user: null,
        isDemo: true,
      }
    }

    return {
      userId: user.id,
      user,
      isDemo: false,
    }
  } catch (err) {
    console.warn("Error resolving auth session, using isolated guest session:", err)
    const guestId = getOrCreateGuestUserId()
    return {
      userId: guestId,
      user: null,
      isDemo: true,
    }
  }
}

export function getAuthRedirectUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/auth/callback`
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://job-search-copilot-six.vercel.app"
  return `${siteUrl.replace(/\/$/, "")}/auth/callback`
}

export async function signInWithEmail(
  email: string,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseBrowserClient()
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { success: false, error: error.message }
      return { success: true }
    } else {
      const redirectTo = getAuthRedirectUrl()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; needsEmailConfirmation?: boolean; error?: string }> {
  try {
    const supabase = getSupabaseBrowserClient()
    const redirectTo = getAuthRedirectUrl()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) return { success: false, error: error.message }

    // If Supabase has email confirmation enabled, data.session is null and data.user is created
    const needsEmailConfirmation = !data.session && !!data.user
    return { success: true, needsEmailConfirmation }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function signOutUser(): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    // Reset guest session to ensure a clean slate
    if (typeof window !== "undefined") {
      localStorage.removeItem("job_search_copilot_guest_uid")
      localStorage.removeItem("job_search_copilot_guest_token")
    }
    window.location.href = "/"
  } catch (err) {
    console.error("Sign out failed:", err)
    window.location.href = "/"
  }
}
