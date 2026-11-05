/** Where to go after signing in: only paths inside the app; anything else goes to the dashboard. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/dashboard";
  }
  return value;
}

/**
 * Opens the app after signing in with a full page load, not client navigation: data kept in this
 * tab's memory never carries over from one session to the next.
 */
export function openApp(path: string) {
  window.location.replace(new URL(path, window.location.href));
}
