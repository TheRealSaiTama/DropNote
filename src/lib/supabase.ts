import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabaseEnv = Boolean(url && key)

export const supabase: SupabaseClient | null = hasSupabaseEnv
  ? createClient(url!, key!)
  : null
