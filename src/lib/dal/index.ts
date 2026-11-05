import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";

// Data access layer: the only way server code learns who is asking. Every query of user data goes
// through a user from here and filters by their id; nothing trusts an id sent by the browser.

export type SessionUser = { id: string; email: string };

/** The signed-in user, or null. Checks the session in the database once per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Request headers first: they make this dynamic, so prerendering never reaches the auth setup.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session ? { id: session.user.id, email: session.user.email } : null;
});
