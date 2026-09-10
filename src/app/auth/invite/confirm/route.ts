import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
export async function GET(request: Request) {
 const url = new URL(request.url); const code = url.searchParams.get("code"); const tokenHash=url.searchParams.get("token_hash"); const type=url.searchParams.get("type");
 if (!code && !(tokenHash && type)) return NextResponse.redirect(new URL("/login", url.origin));
 const supabase = await createSupabaseServerClient(); const { error } = code ? await supabase.auth.exchangeCodeForSession(code) : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "invite" | "magiclink" | "recovery" | "signup" | "email_change" });
 if (error) return NextResponse.redirect(new URL("/login", url.origin));
 if (type === "recovery") return NextResponse.redirect(new URL("/password/update", url.origin));
 const membershipId=url.searchParams.get("membershipId"); const attempt=url.searchParams.get("attempt");
 const accept=new URL("/invite/accept",url.origin); if(membershipId) accept.searchParams.set("membershipId",membershipId); if(attempt) accept.searchParams.set("attempt",attempt);
 return NextResponse.redirect(accept);
}
