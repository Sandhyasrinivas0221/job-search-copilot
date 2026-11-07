import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ""

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
}

if (!supabaseSecretKey && typeof window === "undefined") {
  console.error(
    "[supabase] CRITICAL SECURITY CONFIG: SUPABASE_SERVICE_ROLE_KEY is not defined. Admin operations requiring RLS bypass will be blocked rather than falling back to anon public key."
  )
}

// Client for browser/client-side operations
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Client for server-side operations with service role (bypasses RLS)
// Strict: Never falls back to publishable key to avoid pretending anon access is admin access
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey || "missing-service-role-key-restricted",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export default supabase
