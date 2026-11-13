import { useCallback } from 'react';
import { useDragControls } from 'framer-motion';
import useMediaQuery from './useMediaQuery';

const INTERACTIVE_TARGET_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [role="switch"], [data-no-drawer-drag]';

/**
 * Shared mobile bottom-drawer swipe-down-to-close hook for Framer Motion sheets.
 * Attaches drag initiation to the top handle / header so vertical scrolling or
 * interactive maps inside the drawer body never conflict with dismiss gestures.
 */
export default function useBottomDrawerDrag({
  onClose,
  disabled = false,
  mobileQuery = '(max-width: 639px)',
  distanceThreshold = 75,
  velocityThreshold = 400,
} = {}) {
  const isBottomSheetViewport = useMediaQuery(mobileQuery);
  const dragControls = useDragControls();
  const canDrag = Boolean(isBottomSheetViewport && !disabled);

  const handlePointerDown = useCallback(
    (event) => {
      if (!canDrag) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target?.closest?.(INTERACTIVE_TARGET_SELECTOR)) return;
      dragControls.start(event);
    },
    [canDrag, dragControls],
  );

  const handleDragEnd = useCallback(
    (_event, info) => {
      if (disabled) return;
      if (info.offset.y > distanceThreshold || info.velocity.y > velocityThreshold) {
        onClose?.();
      }
    },
    [disabled, distanceThreshold, onClose, velocityThreshold],
  );

  const drawerMotionProps = {
    drag: canDrag ? 'y' : false,
    dragControls,
    dragListener: false,
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.45 },
    onDragEnd: handleDragEnd,
  };

  const dragHandleProps = canDrag
    ? {
        onPointerDown: handlePointerDown,
        style: { touchAction: 'none' },
      }
    : {};

  return {
    canDrag,
    drawerMotionProps,
    dragHandleProps,
  };
}
