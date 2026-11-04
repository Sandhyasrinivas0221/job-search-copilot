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
 * Ensures User A (e.g. Care Worker) and User B (e.g. Software Engineer)
 * browsing simultaneously have completely isolated workspaces without collision.
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
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
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
    }
    window.location.href = "/"
  } catch (err) {
    console.error("Sign out failed:", err)
    window.location.href = "/"
  }
}
