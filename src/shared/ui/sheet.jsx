import React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "@phosphor-icons/react"
import { cn } from "../../lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-overlay bg-black/40 dark:bg-black/70",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const hasScrolledAncestor = (target, boundary) => {
  let el = target instanceof Element ? target : target?.parentElement;
  while (el && el !== boundary) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return boundary?.scrollTop > 0;
};

const SheetContent = React.forwardRef(({ className, children, side = "bottom", ...props }, ref) => {
  const [panelNode, setPanelNode] = React.useState(null);
  const closeRef = React.useRef(null);

  const setRefs = React.useCallback(
    (node) => {
      setPanelNode(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  React.useEffect(() => {
    const node = panelNode;
    if (!node || side !== "bottom") return undefined;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let dy = 0;
    let tracking = false;
    let eligible = false;

    const resetTransform = (animate = true) => {
      if (!animate) {
        node.style.transition = "";
        node.style.transform = "";
        return;
      }
      node.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
      node.style.transform = "";
      window.setTimeout(() => {
        if (node) node.style.transition = "";
      }, 210);
    };

    const onTouchStart = (e) => {
      if (typeof window !== "undefined" && !window.matchMedia("(max-width: 639px)").matches) {
        eligible = false;
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      dy = 0;
      tracking = false;
      eligible = !hasScrolledAncestor(e.target, node);
    };

    const onTouchMove = (e) => {
      if (!eligible || e.touches.length !== 1) return;
      const t = e.touches[0];
      const deltaY = t.clientY - startY;
      const deltaX = t.clientX - startX;

      if (!tracking) {
        if (Math.abs(deltaY) < 6 && Math.abs(deltaX) < 6) return;
        if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) && !hasScrolledAncestor(e.target, node)) {
          tracking = true;
          node.style.transition = "none";
        } else {
          eligible = false;
          return;
        }
      }

      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, deltaY);
      node.style.transform = `translate3d(0, ${Math.round(dy * 0.85)}px, 0)`;
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const elapsed = Date.now() - startTime;
      const velocity = elapsed >= 32 ? dy / elapsed : 0;
      const shouldClose = dy > 75 || (dy > 24 && velocity > 0.45);
      tracking = false;
      eligible = false;
      if (shouldClose) {
        node.style.transition = "transform 160ms ease-out";
        node.style.transform = "translate3d(0, 100%, 0)";
        closeRef.current?.click();
      } else {
        resetTransform(true);
      }
    };

    const onTouchCancel = () => {
      if (!tracking) return;
      tracking = false;
      eligible = false;
      resetTransform(true);
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [panelNode, side]);

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        aria-modal="true"
        className={cn(
          "fixed z-overlay gap-4 bg-surface-shell shadow-xl transition-transform duration-250 ease-out will-change-transform transform-gpu",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
          "overflow-y-auto overscroll-contain",
          side === "top" && "inset-x-0 top-0 max-h-[90dvh] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[2rem] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          side === "left" && "inset-y-0 left-0 h-full w-3/4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "right" && "inset-y-0 right-0 h-full w-3/4 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          ref={closeRef}
          aria-label="Close"
          className={cn(
            "absolute right-4 top-4 w-11 h-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
            side === "bottom" ? "hidden sm:flex" : "flex"
          )}
        >
          <X size={20} weight="light" className="text-tertiary dark:text-tertiary" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
})
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left px-6 pt-6 pb-4 ring-1 ring-black/5 dark:ring-white/10", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 pb-6", className)} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-xl font-bold text-slate-900 dark:text-slate-100", className)}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-tertiary dark:text-tertiary", className)}
    {...props}
  />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
