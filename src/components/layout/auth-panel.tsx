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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="size-3.5" />
          check your email
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSent(false)
            setErrorMessage(null)
          }}
          className="h-7 px-2 text-xs"
        >
          resend
        </Button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setErrorMessage(null)
    try {
      await onSignIn(email.trim())
      setSent(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send sign-in email'
      setErrorMessage(message)
      if (import.meta.env.DEV) console.error('[auth] sign-in email failed', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (errorMessage) setErrorMessage(null)
        }}
        placeholder="your@email.com"
        className="h-8 w-44 text-sm"
        required
      />
      <Button type="submit" size="sm" disabled={loading}>
        <LogIn />
        {loading ? '…' : 'sign in'}
      </Button>
      {errorMessage && (
        <span className="max-w-[18rem] truncate text-xs text-destructive" title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </form>
  )
}
