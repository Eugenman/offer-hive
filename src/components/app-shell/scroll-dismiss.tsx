"use client";

import { useEffect } from "react";

/**
 * A press that turns into a scroll must not leave a menu open.
 *
 * Menus (Radix) open on `pointerdown`, before it is known whether the finger will tap or swipe. On
 * a phone a small drag over a toolbar button therefore opened the filter or the status menu "by
 * itself". This closes an open menu as soon as the finger travels a few pixels — unless the drag
 * started inside that same menu, where scrolling the list is legitimate.
 */
export function ScrollDismiss() {
  useEffect(() => {
    let start: { x: number; y: number; target: EventTarget | null } | null = null;
    // While this is in the future, the click that ends a swipe is swallowed: it would otherwise
    // toggle the button the finger happened to land on, and the menu would open again.
    let silentUntil = 0;

    const dismiss = () => {
      // Radix closes on a press outside, and Escape is the fallback.
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      silentUntil = performance.now() + 400;
    };

    const onPointerUpCheck = (event: PointerEvent) => {
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const origin = start.target;
      start = null;
      if (moved <= 10) return;
      // A swipe that ended on a button must not open anything.
      silentUntil = performance.now() + 400;
      const menu = document.querySelector(
        '[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="select-content"]',
      );
      if (menu && origin instanceof Node && menu.contains(origin)) return;
      if (menu) dismiss();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (performance.now() > silentUntil) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerDown = (event: PointerEvent) => {
      start = { x: event.clientX, y: event.clientY, target: event.target };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) return;
      const menu = document.querySelector(
        '[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="select-content"]',
      );
      start = null;
      if (!menu) return;
      // Scrolling inside the menu itself is not a stray gesture.
      if (menu.contains(event.target as Node)) return;
      dismiss();
    };

    const onPointerUp = () => {
      start = null;
    };

    // A wheel or a trackpad scroll is a scroll too, and it does not fire `pointermove`.
    const onWheel = () => {
      const popup = document.querySelector(
        '[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="select-content"], [data-slot="tooltip-content"]',
      );
      if (popup) dismiss();
    };

    // Any scroll closes what is open — a hint left hanging over the rows it no longer points at is
    // worse than no hint. Scrolling inside the popup itself is allowed.
    const onScroll = (event: Event) => {
      const popup = document.querySelector(
        '[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="select-content"], [data-slot="tooltip-content"]',
      );
      if (!popup) return;
      if (event.target instanceof Node && popup.contains(event.target)) return;
      dismiss();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUpCheck, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUpCheck, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, []);

  return null;
}
