import React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "../../lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] rounded-full p-1.5 ring-1 ring-black/5 dark:ring-white/10",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2",
      "text-sm font-bold transition-all duration-700 ease-fluid",
      "text-slate-500 dark:text-slate-400",
      "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800",
      "data-[state=active]:text-primary dark:data-[state=active]:text-primary",
      "data-[state=active]:shadow-card data-[state=active]:ring-1 data-[state=active]:ring-black/5",
      "outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
