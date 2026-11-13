import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, renderHook, act } from '@testing-library/react';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import ProfileMobileAccountSheet from '@/features/patient/components/ProfileMobileAccountSheet';
import ProfileConfirmDialog from '@/features/patient/components/ProfileConfirmDialog';
import ProfileAddressModal from '@/features/patient/components/ProfileAddressModal';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/shared/ui/sheet';

const dragState = vi.hoisted(() => ({
  startSpy: vi.fn(),
  latestOnDragEnd: null,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const MOTION_KEYS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'whileTap',
    'whileHover',
    'layout',
    'layoutId',
    'variants',
    'drag',
    'dragControls',
    'dragListener',
    'dragConstraints',
    'dragElastic',
    'onDragEnd',
  ]);

  const createTag = (tag) => {
    const Comp = React.forwardRef((props, ref) => {
      if (typeof props.onDragEnd === 'function') {
        dragState.latestOnDragEnd = props.onDragEnd;
      }
      const cleanProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !MOTION_KEYS.has(key)),
      );
      if (props.drag !== undefined) {
        cleanProps['data-drawer-drag'] = String(props.drag);
      }
      return React.createElement(tag, { ...cleanProps, ref });
    });
    Comp.displayName = `MockMotion(${tag})`;
    return Comp;
  };

  return {
    motion: {
      div: createTag('div'),
      button: createTag('button'),
      span: createTag('span'),
    },
    AnimatePresence: ({ children }) => <>{children}</>,
    useReducedMotion: () => false,
    useDragControls: () => ({ start: dragState.startSpy }),
  };
});

vi.mock('@/features/patient/components/PermanentAddressSection', () => ({
  default: () => <div data-testid="mock-address-editor">Address Editor</div>,
}));

const stubMatchMedia = (matches) => {
  window.matchMedia.mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const dispatchTouchEvent = (target, type, clientY, clientX = 120) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX, clientY }],
  });
  target.dispatchEvent(event);
};

describe('Mobile bottom drawers: zero mobile X close buttons & swipe-down dismiss', () => {
  beforeEach(() => {
    document.body.className = '';
    dragState.startSpy.mockClear();
    dragState.latestOnDragEnd = null;
    stubMatchMedia(true);
  });

  afterEach(() => {
    cleanup();
    stubMatchMedia(false);
  });

  it('useBottomDrawerDrag enables vertical drag on mobile, ignores interactive children, and triggers onClose past threshold', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useBottomDrawerDrag({ onClose }));

    expect(result.current.canDrag).toBe(true);
    expect(result.current.drawerMotionProps.drag).toBe('y');
    expect(result.current.drawerMotionProps.dragListener).toBe(false);
    expect(result.current.dragHandleProps.style).toEqual({ touchAction: 'none' });

    const headerTarget = document.createElement('div');
    result.current.dragHandleProps.onPointerDown({
      pointerType: 'touch',
      button: 0,
      target: headerTarget,
    });
    expect(dragState.startSpy).toHaveBeenCalledTimes(1);

    const buttonTarget = document.createElement('button');
    result.current.dragHandleProps.onPointerDown({
      pointerType: 'touch',
      button: 0,
      target: buttonTarget,
    });
    expect(dragState.startSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.drawerMotionProps.onDragEnd({}, { offset: { y: 40 }, velocity: { y: 50 } });
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      result.current.drawerMotionProps.onDragEnd({}, { offset: { y: 95 }, velocity: { y: 0 } });
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.drawerMotionProps.onDragEnd({}, { offset: { y: 10 }, velocity: { y: 520 } });
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('useBottomDrawerDrag stays disabled on desktop viewports and when disabled=true', () => {
    stubMatchMedia(false);
    const onClose = vi.fn();
    const desktopHook = renderHook(() => useBottomDrawerDrag({ onClose }));
    expect(desktopHook.result.current.canDrag).toBe(false);
    expect(desktopHook.result.current.drawerMotionProps.drag).toBe(false);
    expect(desktopHook.result.current.dragHandleProps).toEqual({});

    stubMatchMedia(true);
    const lockedHook = renderHook(() => useBottomDrawerDrag({ onClose, disabled: true }));
    expect(lockedHook.result.current.canDrag).toBe(false);
    lockedHook.result.current.drawerMotionProps.onDragEnd({}, { offset: { y: 200 }, velocity: { y: 900 } });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ProfileMobileAccountSheet has no X close button and slides down to close', () => {
    const onClose = vi.fn();
    render(
      <ProfileMobileAccountSheet
        open
        onClose={onClose}
        fullName="Juan Dela Cruz"
        email="juan@munticares.ph"
      />,
    );

    expect(screen.getByText(/Account & Health Exports/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Close/i })).not.toBeInTheDocument();

    act(() => {
      dragState.latestOnDragEnd?.({}, { offset: { y: 120 }, velocity: { y: 0 } });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ProfileConfirmDialog and ProfileAddressModal hide X on mobile (hidden sm:flex) and close on downward drag', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <ProfileConfirmDialog
        open
        title="Discard edits?"
        description="Unsaved profile edits will be lost."
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    const confirmClose = screen.getByRole('button', { name: /Close confirmation dialog/i });
    expect(confirmClose.className).toContain('hidden');
    expect(confirmClose.className).toContain('sm:flex');

    act(() => {
      dragState.latestOnDragEnd?.({}, { offset: { y: 110 }, velocity: { y: 0 } });
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const onCloseAddress = vi.fn();
    render(
      <ProfileAddressModal
        open
        onClose={onCloseAddress}
        address="Alabang, Muntinlupa"
      />,
    );

    const addressClose = screen.getByRole('button', { name: /Close address editor/i });
    expect(addressClose.className).toContain('hidden');
    expect(addressClose.className).toContain('sm:flex');

    act(() => {
      dragState.latestOnDragEnd?.({}, { offset: { y: 0 }, velocity: { y: 450 } });
    });
    expect(onCloseAddress).toHaveBeenCalledTimes(1);
  });

  it('SheetContent (side=bottom) hides Close X on mobile and dismisses on downward touch slide', () => {
    function BottomSheetHarness() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" data-testid="bottom-sheet">
            <SheetTitle>Provider Profile</SheetTitle>
            <SheetDescription>Inspect provider details</SheetDescription>
            <div>Body content</div>
          </SheetContent>
        </Sheet>
      );
    }

    render(<BottomSheetHarness />);
    const sheet = screen.getByTestId('bottom-sheet');
    const closeBtn = screen.getByRole('button', { name: /^Close$/i });
    expect(closeBtn.className).toContain('hidden');
    expect(closeBtn.className).toContain('sm:flex');

    // Small downward movement (< 75px) does NOT close the drawer
    act(() => {
      dispatchTouchEvent(sheet, 'touchstart', 100);
      dispatchTouchEvent(sheet, 'touchmove', 130);
      dispatchTouchEvent(sheet, 'touchend', 130);
    });
    expect(screen.getByText('Provider Profile')).toBeInTheDocument();

    // Full downward swipe (> 75px) closes the drawer
    act(() => {
      dispatchTouchEvent(sheet, 'touchstart', 100);
      dispatchTouchEvent(sheet, 'touchmove', 220);
      dispatchTouchEvent(sheet, 'touchend', 220);
    });
    expect(screen.queryByText('Provider Profile')).not.toBeInTheDocument();
  });
});
