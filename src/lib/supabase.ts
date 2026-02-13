import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

// Client for browser/client-side operations
export const supabase = createClient(supabaseUrl, supabaseKey)

// Client for server-side operations with service role (if needed)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || supabaseKey)

export default supabase
