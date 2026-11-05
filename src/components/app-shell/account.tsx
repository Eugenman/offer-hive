import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { AccountMenu, AccountPlaceholder } from "./account-menu";

async function CurrentAccount() {
  const user = await getCurrentUser();
  return user ? <AccountMenu email={user.email} /> : null;
}

/** The signed-in account, read from the session on the server; the shell around it stays static. */
export function Account() {
  return (
    <Suspense fallback={<AccountPlaceholder />}>
      <CurrentAccount />
    </Suspense>
  );
}
