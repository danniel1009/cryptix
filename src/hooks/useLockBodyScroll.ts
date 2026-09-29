"use client";

import { useEffect } from "react";

/**
 * Body scroll lock with nesting support (mobile menu → modal). The lock is
 * released when the last locker unmounts or passes `false`.
 * Compensates the scrollbar width so the page does not shift on desktop.
 */
let lockCount = 0;
let previousOverflow = "";
let previousPaddingRight = "";

function lock() {
  if (lockCount === 0) {
    const body = document.body;
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body;
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
  }
}

export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lock();
    return unlock;
  }, [locked]);
}
