import Link from "next/link";
import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";
import { UserDetailPanel } from "@/components/admin-users/UserDetailPanel";
import { readAdminUserDetail } from "@/features/admin-users/read";
export const dynamic = "force-dynamic";
async function AdminUserDetailContent({ membershipId }: { membershipId: string }) { const result=await readAdminUserDetail(membershipId); return result.detail?<><UserDetailPanel detail={result.detail}/><Link className="px-6" href="/admin/users">Tillbaka till användare</Link></>:<section className="p-6"><p role="alert">{result.error ?? "Användaren hittades inte."}</p><Link href="/admin/users">Tillbaka till användare</Link></section>; }
export default async function AdminUserDetail({params}:{params:Promise<{membershipId:string}>}){const {membershipId}=await params; return <RouteAccessBoundary route="/admin/users"><AdminUserDetailContent membershipId={membershipId}/></RouteAccessBoundary>;}
