import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background shadow-[var(--shadow-panel)] hover:-translate-y-0.5 hover:opacity-95',
        outline:
          'border border-line-strong bg-surface-elevated text-foreground hover:bg-white/90',
        ghost: 'bg-transparent text-muted-foreground hover:bg-white/60 hover:text-foreground',
        secondary:
          'bg-surface-strong text-foreground hover:bg-muted',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 px-3 text-xs uppercase tracking-[0.18em]',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}

export { Button }
