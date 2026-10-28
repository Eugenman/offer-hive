"use client";

// Going back from an application restores the list where the user was and focuses that row or card.
const LIST_URL_KEY = "offerhive:list-url";
const FOCUS_KEY = "offerhive:return-focus";

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Not critical: going back still works, just without restoring focus.
  }
}

/** Called by the list views when an application is opened. */
export function rememberListPosition(applicationId: string) {
  write(LIST_URL_KEY, `${location.pathname}${location.search}`);
  write(FOCUS_KEY, applicationId);
}

/** Where "← Отклики" leads: the exact list view the user came from. */
export function listUrl() {
  const url = read(LIST_URL_KEY);
  return url?.startsWith("/dashboard") ? url : "/dashboard";
}

/** Read once by the list after it renders; returns the id to focus. */
export function takeReturnFocus(): string | null {
  const id = read(FOCUS_KEY);
  write(FOCUS_KEY, null);
  return id;
}
