import { cn } from "../../lib/utils";
import { Button } from "./button";

// Nested CTA / Island Button — pill + button-in-button trailing icon island
// Usage: <IslandButton icon={<ArrowUpRight size={16} weight="light" />}>Find a Provider</IslandButton>
const IslandButton = ({ icon, className, children, ...props }) => (
  <Button className={cn("gap-3 pr-2", className)} {...props}>
    <span>{children}</span>
    {icon && <span className="btn-island-icon">{icon}</span>}
  </Button>
);

export { IslandButton };
