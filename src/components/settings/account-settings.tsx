import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { AccountSection } from "./account-section";

async function CurrentAccountSection() {
  const user = await getCurrentUser();
  return user ? <AccountSection email={user.email} /> : null;
}

/** The Account section of Settings, read from the session on the server. */
export function AccountSettings() {
  return (
    <Suspense>
      <CurrentAccountSection />
    </Suspense>
  );
}
