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

export async function getClientSession(): Promise<ClientUserSession> {
  try {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        userId: FALLBACK_TEST_USER_ID,
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
    console.warn("Error resolving auth session, falling back to demo session:", err)
    return {
      userId: FALLBACK_TEST_USER_ID,
      user: null,
      isDemo: true,
    }
  }
}
