import Link from "next/link";
import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";
import { UserDetailPanel } from "@/components/admin-users/UserDetailPanel";
import { readAdminUserDetail } from "@/features/admin-users/read";
import { readResourceForMembership } from "@/features/resources/read";
import { isResourceE2eSaveFailureEnabled } from "@/server/resources/e2e-save-failure";
export const dynamic = "force-dynamic";
async function AdminUserDetailContent({ membershipId, resourceSaveFailureOnce }: { membershipId: string; readonly resourceSaveFailureOnce: boolean }) { const [result, resource]=await Promise.all([readAdminUserDetail(membershipId),readResourceForMembership(membershipId)]); return result.detail?<><UserDetailPanel detail={result.detail} resource={resource} resourceSaveFailureOnce={resourceSaveFailureOnce}/><Link className="px-6" href="/admin/users">Tillbaka till användare</Link></>:<section className="p-6"><p role="alert">{result.error ?? "Användaren hittades inte."}</p><Link href="/admin/users">Tillbaka till användare</Link></section>; }
export default async function AdminUserDetail({params,searchParams}:{params:Promise<{membershipId:string}>;searchParams:Promise<{resourceSaveFailure?:string}>}){const [{membershipId},query]=await Promise.all([params,searchParams]); return <RouteAccessBoundary route="/admin/users"><AdminUserDetailContent membershipId={membershipId} resourceSaveFailureOnce={query.resourceSaveFailure === "once" && isResourceE2eSaveFailureEnabled()}/></RouteAccessBoundary>;}
