import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { LogIn, LogOut, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hasSupabaseEnv } from '@/lib/supabase'

interface AuthPanelProps {
  user: User | null
  onSignIn: (email: string) => Promise<void>
  onSignOut: () => Promise<void>
}

export function AuthPanel({ user, onSignIn, onSignOut }: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!hasSupabaseEnv) {
    return (
      <span className="text-xs text-muted-foreground">
        local-only
      </span>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[10rem] truncate text-xs text-muted-foreground sm:block">
          {user.email}
        </span>
        <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
          <LogOut />
          sign out
        </Button>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="size-3.5" />
        check your email
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await onSignIn(email.trim())
    setSent(true)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="h-8 w-44 text-sm"
        required
      />
      <Button type="submit" size="sm" disabled={loading}>
        <LogIn />
        {loading ? '…' : 'sign in'}
      </Button>
    </form>
  )
}
