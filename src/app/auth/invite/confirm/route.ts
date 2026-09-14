import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTrustedAuthEmailCallbackOrigin } from "@/features/admin-users/auth-email-callback";
export async function GET(request: Request) {
 const url = new URL(request.url); const code = url.searchParams.get("code"); const tokenHash=url.searchParams.get("token_hash"); const type=url.searchParams.get("type");
 const origin = resolveTrustedAuthEmailCallbackOrigin(process.env.NEXT_PUBLIC_APP_URL, url.origin, process.env.NODE_ENV === "production");
 if (!origin) return new NextResponse(null, { status: 400 });
 // Implicit email links carry their session in `#...`. A fragment is not sent
 // to this server route, so retain only the established invitation context and
 // let the browser completion page initialize the public Auth client.
 if (!code && !(tokenHash && type)) {
  const complete = new URL("/auth/invite/complete", origin);
  const membershipId = url.searchParams.get("membershipId"); const attempt = url.searchParams.get("attempt");
  if (membershipId) complete.searchParams.set("membershipId", membershipId);
  if (attempt) complete.searchParams.set("attempt", attempt);
  return NextResponse.redirect(complete);
 }
 const supabase = await createSupabaseServerClient(); const { error } = code ? await supabase.auth.exchangeCodeForSession(code) : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "invite" | "magiclink" | "recovery" | "signup" | "email_change" });
 if (error) return NextResponse.redirect(new URL("/login", origin));
 if (type === "recovery") return NextResponse.redirect(new URL("/password/update", origin));
 const membershipId=url.searchParams.get("membershipId"); const attempt=url.searchParams.get("attempt");
 const accept=new URL("/invite/accept",origin); if(membershipId) accept.searchParams.set("membershipId",membershipId); if(attempt) accept.searchParams.set("attempt",attempt);
 return NextResponse.redirect(accept);
}
