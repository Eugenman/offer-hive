export const THEME_COOKIE = "theme";
export const SIDEBAR_COOKIE = "sidebar";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export type SidebarState = "expanded" | "collapsed";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Runs in <head> before first paint, so theme and sidebar width never flash or shift.
// Reads cookies on the client to keep server-rendered pages static.
export const UI_PREFS_SCRIPT = `(function(){try{var d=document.documentElement;function c(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}var t=c("${THEME_COOKIE}")||"system";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",t);if(c("${SIDEBAR_COOKIE}")==="collapsed")d.setAttribute("data-sidebar","collapsed")}catch(e){}})()`;
