import { cn } from "../../lib/utils";

// Soft Structuralism table — hairline rows, diffused hover, no harsh borders
const TableShell = ({ className, children, ...props }) => (
  <div className={cn("bezel", className)} {...props}>
    <div className="bezel-inner overflow-x-auto shadow-card">
      <table className="w-full text-sm">{children}</table>
    </div>
  </div>
);

const TableHead = ({ className, ...props }) => (
  <thead className={cn("bg-black/[0.02] dark:bg-white/[0.03]", className)} {...props} />
);

const TableHeaderCell = ({ className, ...props }) => (
  <th
    className={cn(
      "px-4 py-3 text-left text-[10px] uppercase tracking-[0.2em] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap",
      className
    )}
    {...props}
  />
);

const TableRow = ({ className, ...props }) => (
  <tr
    className={cn(
      "ring-1 ring-black/5 dark:ring-white/5 rounded-2xl transition-all duration-700 ease-fluid hover:bg-primary/5 dark:hover:bg-primary/10",
      className
    )}
    {...props}
  />
);

const TableCell = ({ className, ...props }) => (
  <td className={cn("px-4 py-3 text-slate-700 dark:text-slate-200", className)} {...props} />
);

export { TableShell, TableHead, TableHeaderCell, TableRow, TableCell };
