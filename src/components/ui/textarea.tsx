import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-44 w-full rounded-[1.75rem] border border-line bg-white/70 px-4 py-4 text-sm leading-7 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
