/**
 * A script that runs during HTML parsing on the server-rendered page only.
 * On the client it renders as text/plain, so React neither warns nor re-runs it.
 * Pattern from the Next.js "Preventing flash before hydration" guide.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
