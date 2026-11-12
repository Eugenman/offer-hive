"use client";

import { useSyncExternalStore } from "react";

/** Phones only: tablets and desktops keep the multi-column board. */
// Tailwind's `max-[480px]:` compiles to `width < 480px`, so 480 itself is a tablet. The JS
// threshold matches it exactly, or the board and the scripts would disagree at that one width.
export const PHONE_QUERY = "(max-width: 479.98px)";

/**
 * Whether the viewport is a phone. Used for behaviour that cannot be done in CSS alone: the board
 * turns off desktop drag-and-drop and offers a status sheet instead.
 */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    // Server rendering cannot know the width; the desktop board is the safe default.
    () => false,
  );
}
