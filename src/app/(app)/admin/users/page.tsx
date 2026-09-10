import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";
import { UsersPage } from "@/components/admin-users/UsersPage";
import { readAdminUsers } from "@/features/admin-users/read";
export const dynamic = "force-dynamic";
async function AdminUsersContent(){ const result=await readAdminUsers(); return <UsersPage rows={result.rows} loadError={result.error}/>; }
export default async function AdminUsersRoute(){ return <RouteAccessBoundary route="/admin/users"><AdminUsersContent/></RouteAccessBoundary>; }
