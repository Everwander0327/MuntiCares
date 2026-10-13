import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-bold transition-all duration-700 ease-fluid outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] group",
  {
    variants: {
      variant: {
        default: "bg-primary text-white shadow-card hover:bg-primary-700 hover:shadow-soft",
        destructive: "bg-red-500 text-white shadow-card hover:bg-red-600",
        outline: "ring-1 ring-primary/30 text-primary hover:bg-primary hover:text-white",
        secondary: "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:bg-slate-100 dark:hover:bg-slate-700",
        ghost: "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
