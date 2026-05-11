import { redirect } from "next/navigation";

/** Public landing lives at `/` (`app/page.tsx`). This path exists for bookmarks and links. */
export default function WelcomeRedirectPage() {
  redirect("/");
}
