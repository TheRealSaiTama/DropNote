import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-12 w-full rounded-full border border-line bg-white/70 px-4 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
