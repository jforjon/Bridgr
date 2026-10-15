import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Buttons are the design system's `.btn-*` classes — every state (hover,
 * pressed, focus-visible, disabled) lives in globals.css so a button looks the
 * same whether it is rendered through this component or written as markup.
 * Sizing is fixed by the system: 48px controls, pill radius, 16px label.
 */
const buttonVariants = cva("tap-target", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      quiet: "btn-quiet",
      destructive: "btn-destructive",
      icon: "btn-icon",
    },
    fullWidth: {
      true: "w-full",
      false: "",
    },
  },
  defaultVariants: {
    variant: "primary",
    fullWidth: false,
  },
})

function Button({
  className,
  variant = "primary",
  fullWidth = false,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, fullWidth, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
