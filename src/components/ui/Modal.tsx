"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";

/* ------------------------------------------------------------------ */
/* Focus trap (shared with the mobile menu)                            */
/* ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export interface FocusTrapOptions {
  /** Element to focus on open instead of the first focusable. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Called on Escape. */
  onEscape?: () => void;
  /** Return focus to the previously focused element on close. Default true. */
  returnFocus?: boolean;
}

/**
 * While `active`: moves focus into `containerRef`, cycles Tab/Shift+Tab inside
 * it, calls `onEscape` on Escape, and restores focus to the opener on close.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusTrapOptions = {},
) {
  const { initialFocus, returnFocus = true } = options;
  const onEscapeRef = useRef(options.onEscape);
  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const opener = document.activeElement as HTMLElement | null;
    // `checkVisibility` is the reliable test (fixed-position elements have a null
    // offsetParent); environments without it (jsdom) treat elements as visible.
    const isVisible = (el: HTMLElement) =>
      typeof el.checkVisibility === "function" ? el.checkVisibility() : !el.closest("[hidden]");
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getAttribute("aria-hidden") !== "true" && isVisible(el),
      );

    const frame = requestAnimationFrame(() => {
      const target = initialFocus?.current ?? focusables()[0] ?? container;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && container.contains(current);
      if (event.shiftKey) {
        if (current === first || !inside) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !inside) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocus && opener && typeof opener.focus === "function" && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocus, returnFocus]);
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  /** Accessible name of the close button (t.common.close). */
  closeLabel: string;
  /** Optional sticky footer (actions). */
  footer?: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Escape / backdrop dismiss. Default true. */
  dismissible?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const SIZES = { md: "sm:max-w-lg", lg: "sm:max-w-2xl" } as const;

const noop = () => () => {};
/** `true` after hydration — portals need `document`. */
function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * Portal dialog: role="dialog" aria-modal, focus trap, Escape/backdrop close,
 * body scroll lock, return focus to the opener. Mobile renders a full-height
 * sheet sliding up; desktop a centred card over a blurred glass backdrop.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeLabel,
  footer,
  className,
  initialFocusRef,
  dismissible = true,
}: ModalProps) {
  const mounted = useMounted();
  const reduced = useReducedMotionSafe();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-description`;

  useLockBodyScroll(open);
  useFocusTrap(panelRef, open, {
    initialFocus: initialFocusRef,
    onEscape: dismissible ? onClose : undefined,
  });

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!dismissible) return;
    if (event.target === event.currentTarget) onClose();
  };

  if (!mounted) return null;

  const panelMotion = isDesktop
    ? {
        initial: { opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 12 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: reduced ? 1 : 0.98, y: reduced ? 0 : 8 },
      }
    : {
        initial: reduced ? { opacity: 0 } : { y: "100%" },
        animate: reduced ? { opacity: 1 } : { y: 0 },
        exit: reduced ? { opacity: 0 } : { y: "100%" },
      };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal-root"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        >
          <div
            className="absolute inset-0 bg-bg/75 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onBackdropClick}
            data-testid="modal-backdrop"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            {...panelMotion}
            transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
            className={cn(
              "relative flex w-full flex-col bg-surface shadow-float outline-none",
              "h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-line",
              SIZES[size],
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
              <div className="min-w-0 pt-1">
                <h2 id={titleId} className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1.5 text-sm text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <IconButton
                label={closeLabel}
                icon={<X />}
                onClick={onClose}
                disabled={dismissible === false}
                className="-mr-2 -mt-1"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 scrollbar-thin sm:px-8">{children}</div>
            {footer ? (
              <div className="border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-4">
                {footer}
              </div>
            ) : (
              <div className="pb-safe sm:hidden" />
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
