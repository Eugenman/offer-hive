"use client";

import { useEffect } from "react";

/**
 * Tab title for data loaded on the client (route metadata can't know it).
 * Next.js rewrites <title> from metadata after navigation, so while this page is visible the hook keeps
 * re-applying its title; when Next.js hides the page in <Activity> it stops and restores the previous one.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = previous;
    };
  }, [title]);
}
