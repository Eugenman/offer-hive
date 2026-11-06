import type { Metadata } from "next";
import { Suspense } from "react";
import { Hexagon } from "lucide-react";
import { BackLink } from "./back-link";

export const metadata: Metadata = { title: "Privacy Policy" };

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** Open to everyone, signed in or not. */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <article className="mx-auto grid max-w-2xl gap-8">
        <div className="flex items-center gap-2">
          <Hexagon className="size-6 fill-foreground text-foreground" aria-hidden />
          <span className="text-base font-semibold">Offerhive</span>
        </div>
        {/* The link reads ?from=, which makes it dynamic; the policy around it stays static. */}
        <Suspense fallback={<div className="h-5" />}>
          <BackLink />
        </Suspense>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>

        <Part title="What we store">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address, to sign you in and to send your recovery code.</li>
            <li>
              Your password and your recovery code, only as hashes: nobody, including us, can read them back.
            </li>
            <li>
              Your job search: applications, interview steps, notes, status history, and the statistics of
              applications you deleted.
            </li>
          </ul>
        </Part>

        <Part title="What we don’t store">
          <p>
            We don’t record your IP address or your browser and device. There are no analytics, no ads and no
            tracking.
          </p>
        </Part>

        <Part title="Cookies and your browser">
          <p>
            One cookie keeps you signed in. Two more remember your theme and whether the sidebar is collapsed.
            Your browser also keeps changes that haven’t reached the server yet, so nothing is lost when the
            connection drops, and the view you chose for your applications.
          </p>
        </Part>

        <Part title="Emails">
          <p>
            We email you your recovery code when you create an account, reset your password or create a new
            code. We send nothing else.
          </p>
        </Part>

        <Part title="Who sees your data">
          <p>Only you. We don’t sell or share your data with anyone.</p>
        </Part>

        <Part title="Deleting your data">
          <p>
            Deleted applications stay in the archive for 30 days, then they are erased for good. To delete
            everything at once, open Settings, then Account, and choose Delete account: your account and all
            your data are deleted right away.
          </p>
        </Part>
      </article>
    </main>
  );
}
