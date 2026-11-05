import { createAuthClient } from "better-auth/react";

/** Sign-in and sign-out from the browser. The server is the same origin, so no base URL. */
export const authClient = createAuthClient();
