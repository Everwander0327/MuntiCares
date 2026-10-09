import { cn } from "../../lib/utils";

const badgeVariants = {
  default: "bg-primary/10 text-primary-700 dark:text-primary-200 ring-1 ring-primary/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20",
  danger: "bg-red-500/10 text-red-600 dark:text-red-300 ring-1 ring-red-500/20",
  neutral: "bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10",
};

const Badge = ({ variant = "default", className, ...props }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-700 ease-fluid",
      badgeVariants[variant],
      className
    )}
    {...props}
  />
);

const Eyebrow = ({ className, ...props }) => (
  <span className={cn("eyebrow", className)} {...props} />
);

export { Badge, Eyebrow, badgeVariants };
