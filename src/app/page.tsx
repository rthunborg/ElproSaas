import { redirect } from "next/navigation";

// Root entry → shell landing. (Auth boundary / `/login` is Epic 2; no auth check here.)
export default function Home() {
  redirect("/dashboard");
}
