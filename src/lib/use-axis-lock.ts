"use client";

import { useEffect, type RefObject } from "react";

/**
 * One gesture scrolls along one axis: the first few pixels decide whether the swipe goes sideways
 * or up and down, and the rest of the gesture stays on it. Without this a diagonal swipe drifts
 * both ways at once — the table jitters sideways while you try to go down the rows.
 *
 * The browser cannot lock a native scroll mid-gesture (`touch-action` is read once, at the start),
 * so the scroll is driven by hand here: `touchmove` is cancelled and the element is scrolled along
 * the chosen axis. To keep it feeling native, the release carries the momentum on that axis.
 */
export type AxisTargets = {
  /** What scrolls sideways, and what scrolls up and down. Usually the same element. */
  x?: HTMLElement | null;
  y?: HTMLElement | null;
};

export function useAxisLockScroll(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  /**
   * Resolves the two scrollers under the finger when they are different elements, as on the board:
   * the columns go sideways on the board and up and down inside a card column.
   * `onLock` fires once per gesture, when the axis is decided — the moment to close popups the
   * browser already opened on pointerdown.
   */
  options: { targets?: (event: TouchEvent) => AxisTargets; onLock?: () => void } = {},
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // A tap wobbles by a few pixels; locking before that would eat the tap (the checkbox felt slow).
    const THRESHOLD = 12;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let axis: "x" | "y" | null = null;
    let last: { x: number; y: number; at: number } | null = null;
    let velocity = 0;
    let frame = 0;
    let pendingFrame = 0;
    // The axis of the gesture that just ended: `axis` itself is cleared before the glide runs.
    let glideAxis: "x" | "y" = "y";
    // The newest position from the finger; the frame below picks it up, so one frame per repaint.
    let targetX = 0;
    let targetY = 0;
    // The two scrollers of the current gesture: sideways and up-and-down.
    let scrollX: HTMLElement = element;
    let scrollY: HTMLElement = element;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
    };

    const glide = () => {
      if (Math.abs(velocity) < 0.02) {
        stop();
        return;
      }
      // Distance of one frame at the current speed, then a gentle decay: 0.97 keeps the list
      // gliding for about a second, like a native fling.
      // Positive velocity means the finger moved left/up, so the content keeps going right/down.
      if (glideAxis === "x") scrollX.scrollLeft += velocity * 16.7;
      else scrollY.scrollTop += velocity * 16.7;
      velocity *= 0.97;
      frame = requestAnimationFrame(glide);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      stop();
      const touch = event.touches[0];
      const resolved = options.targets?.(event) ?? {};
      scrollX = resolved.x ?? element;
      scrollY = resolved.y ?? element;
      startX = touch.clientX;
      startY = touch.clientY;
      startLeft = scrollX.scrollLeft;
      startTop = scrollY.scrollTop;
      last = { x: touch.clientX, y: touch.clientY, at: performance.now() };
      velocity = 0;
      axis = null;
    };

    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (axis === null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        options.onLock?.();
      }
      // The gesture belongs to one axis now: the other one stays where it is.
      event.preventDefault();
      targetX = axis === "x" ? startLeft - dx : scrollX.scrollLeft;
      targetY = axis === "y" ? startTop - dy : scrollY.scrollTop;
      if (!pendingFrame) {
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = 0;
          scrollX.scrollLeft = targetX;
          scrollY.scrollTop = targetY;
        });
      }

      if (last) {
        const now = performance.now();
        const elapsed = now - last.at;
        if (elapsed > 0 && elapsed < 100) {
          const moved = axis === "x" ? last.x - touch.clientX : last.y - touch.clientY;
          velocity = moved / elapsed;
        }
      }
      last = { x: touch.clientX, y: touch.clientY, at: performance.now() };
    };

    const onEnd = () => {
      if (axis !== null) glideAxis = axis;
      if (axis !== null && Math.abs(velocity) > 0.2) {
        frame = requestAnimationFrame(glide);
      }
      axis = null;
      last = null;
    };

    // A trackpad or a mouse wheel can also move both axes at once (a diagonal two-finger pan).
    const onWheel = (event: WheelEvent) => {
      const dx = event.deltaX;
      const dy = event.deltaY;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const dominant = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      const target = dominant === "x" ? scrollX : scrollY;
      const delta = dominant === "x" ? dx : dy;
      const position = dominant === "x" ? target.scrollLeft : target.scrollTop;
      const limit =
        dominant === "x"
          ? target.scrollWidth - target.clientWidth
          : target.scrollHeight - target.clientHeight;
      // At the end of the axis there is nothing to lock: let the event chain to the parent.
      if (delta > 0 ? position >= limit - 1 : position <= 1) return;
      event.preventDefault();
      if (dominant === "x") scrollX.scrollLeft = position + delta;
      else scrollY.scrollTop = position + delta;
    };

    // Native panning is what moves both axes at once on some browsers (iOS keeps the gesture it
    // decided on before `preventDefault`). With `touch-action: none` the scroll is ours alone,
    // and the axis rule holds everywhere.
    const previousTouchAction = element.style.touchAction;
    const previousOverscroll = element.style.overscrollBehavior;
    element.style.touchAction = "none";
    element.style.overscrollBehavior = "contain";

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd, { passive: true });
    element.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      stop();
      element.style.touchAction = previousTouchAction;
      element.style.overscrollBehavior = previousOverscroll;
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
    // `options` is read inside the handlers, so it must not re-run the effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled]);
}
