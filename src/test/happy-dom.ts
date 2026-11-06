import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Component tests need a DOM; bun has none by default. Registered once for the whole test run.
GlobalRegistrator.register({ url: "http://localhost:3000" });
