import { redirect } from "next/navigation";

// The landing page is designed later; until then the root opens the dashboard.
export default function Home() {
  redirect("/dashboard");
}
