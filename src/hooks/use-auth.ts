import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { supabase, hasSupabaseEnv } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(hasSupabaseEnv)

  useEffect(() => {
    if (!hasSupabaseEnv) return

    supabase!.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase!.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string) {
    if (!hasSupabaseEnv) return
    await supabase!.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
  }

  async function signOut() {
    if (!hasSupabaseEnv) return
    await supabase!.auth.signOut()
  }

  return { user, loading, signIn, signOut }
}
