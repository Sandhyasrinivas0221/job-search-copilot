import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  supabasePublishableKey ||
  ""

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing Supabase environment variables")
}

// Client for browser/client-side operations
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Client for server-side operations with service role (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

export default supabase
