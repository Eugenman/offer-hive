import { Hexagon } from "lucide-react";

/** Hides tabs, titles and links while the recovery code is on screen. */
export const HIDE_WITH_CODE = "group-has-[[data-recovery-code]]/auth:hidden";

/** The sign-in pages: the logo and one centered column. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="group/auth w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Hexagon className="size-6 fill-foreground text-foreground" aria-hidden />
          <span className="text-base font-semibold">Offerhive</span>
        </div>
        {children}
      </div>
    </main>
  );
}
