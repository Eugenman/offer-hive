import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, Setting } from "@/components/settings/section";

export const metadata: Metadata = { title: "Privacy settings" };

export default function PrivacySettingsPage() {
  return (
    <Section title="Privacy">
      <Setting
        title="Privacy Policy"
        description="What Offerhive stores about you, and what it doesn’t. No analytics, no ads, no tracking."
      >
        <Button variant="outline" asChild>
          <Link href="/privacy?from=settings">
            <ShieldCheck aria-hidden />
            Read the Privacy Policy
          </Link>
        </Button>
      </Setting>
    </Section>
  );
}
