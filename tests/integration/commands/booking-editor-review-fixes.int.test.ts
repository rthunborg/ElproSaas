import { createHash } from "node:crypto";
import { expect, test, vi } from "vitest";
import { withConflictFixture } from "../../support/booking-conflicts-atdd";
import { bookingInput, bookingSnapshot } from "../../support/bookings-atdd";
import { actualEditorBindings } from "../../support/booking-editor-production";
import { adminQuery } from "../../factories/admin-sql";
import { openEditorReceipt, sealEditorReceipt } from "@/server/bookings/editor-preview";
import { LOCAL_TEST_BOOKING_CONFLICT_SECRET as secret } from "../../support/test-env";
import * as clientFactory from "@/server/db/supabase-server-client";
import { readBookingEditorOptions } from "@/features/resources/bookings-read";

test("Round1 genuine capacity group with 95 peers saves and accepts every exact association; signed partial map denied", async () => {
  await withConflictFixture(async fx => {
    const b=await actualEditorBindings(); const ids=Array.from({length:95},()=>crypto.randomUUID());
    await adminQuery(`insert into public.bookings(id,tenant_id,starts_at,ends_at,description,create_command_id,create_payload_digest,create_result)
      select id,$2,'2026-10-12T06:00:00Z'::timestamptz+(n-1)*interval '1 minute',
      '2026-10-12T06:00:00Z'::timestamptz+n*interval '1 minute','Round1 isolated capacity peer',gen_random_uuid(),repeat('a',64),jsonb_build_object('bookingId',id::text)
      from unnest($1::uuid[]) with ordinality as peers(id,n)`,[ids,fx.base.tenantA.id]);
    await adminQuery("insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) select $1,id,$3 from unnest($2::uuid[]) id",[fx.base.tenantA.id,ids,fx.ownProfile.id]);
    const input={...bookingInput([fx.ownProfile.id],{startsAt:"2026-10-12T06:00:00Z",endsAt:"2026-10-12T15:00:00Z"}),proposedCreateId:crypto.randomUUID()};
    const p=await b.preview(fx.adminClient,"create",input); expect(p.ok).toBe(true); if(!p.ok)throw new Error(p.code);
    const capacity=p.data.warnings.find(w=>w.conflictType==="over_capacity")!;
    expect(capacity.bookingIds.sort()).toEqual([...ids,input.proposedCreateId].sort());
    expect(capacity.naturalKey.length).toBeGreaterThan(4000);
    const reviewed={...input,decision:{acknowledged:true,reviewedLogicalIds:p.data.warnings.map(w=>w.naturalKey),selectedLogicalIds:[capacity.naturalKey],reason:"Reviewed all 96 participants",receipt:p.data.receipt}};
    const before=await bookingSnapshot(fx.tenantIds);
    const claims=openEditorReceipt(p.data.receipt,secret);
    const partial=sealEditorReceipt({...claims,groups:claims.groups.map(g=>g.logicalId===capacity.naturalKey?{...g,keys:g.keys.slice(0,1)}:g)},secret);
    const denied=await b.direct(fx.adminClient,"create",{...reviewed,decision:{...reviewed.decision,receipt:partial}});
    expect(denied.error).not.toBeNull(); expect(denied.data).toBeNull(); expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    expect((await b.save(fx.adminClient,"create",{...reviewed,decision:{...reviewed.decision,selectedLogicalIds:[capacity.naturalKey+"forged"]}},crypto.randomUUID())).ok).toBe(false);
    expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    expect(await b.save(fx.adminClient,"create",reviewed,crypto.randomUUID())).toMatchObject({ok:true,data:{bookingId:input.proposedCreateId}});
    const after=await bookingSnapshot(fx.tenantIds);
    const [engineKey,person]=JSON.parse(capacity.naturalKey) as [string,string];
    const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
    const keys=[`v1:${hash([engineKey,person])}`,...[...ids,input.proposedCreateId].sort().slice(2).map(id=>`v2:${hash([engineKey,person,id])}`)].sort();
    const [actor]=await adminQuery<{id:string}>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2",[fx.base.tenantA.id,fx.base.adminA.id]);
    const accepted=after.conflicts.filter(row=>keys.includes(String(row.natural_key)));
    expect(accepted.map(row=>row.natural_key).sort()).toEqual(keys);
    expect(accepted.every(row=>row.status==="accepted"&&row.acceptance_reason===reviewed.decision.reason&&row.accepted_by_membership_id===actor.id&&row.accepted_at)).toBe(true);
    expect(after.audit.filter(row=>!before.audit.some(prior=>prior.id===row.id))).toHaveLength(1);
    expect(after.conflicts.filter(row=>!keys.includes(String(row.natural_key))).every(row=>row.status==="open")).toBe(true);
  });
});

test("Round1 authorized picker and warning resolve the existing same-tenant staff email identity", async () => {
  await withConflictFixture(async fx => {
    const [identity]=await adminQuery<{label:string}>("select coalesce(nullif(btrim(m.invited_email),''),u.email) as label from public.person_profiles p join public.tenant_memberships m on m.id=p.membership_id and m.tenant_id=p.tenant_id join auth.users u on u.id=m.user_id where p.id=$1 and p.tenant_id=$2",[fx.ownProfile.id,fx.base.tenantA.id]);
    expect(identity.label).toContain("@");
    const stub=vi.spyOn(clientFactory,"createSupabaseServerClient").mockResolvedValue(fx.adminClient as never);
    try {const options=await readBookingEditorOptions(); expect(options.error).toBeNull(); expect(options.people.find(p=>p.id===fx.ownProfile.id)?.label).toBe(identity.label);
      expect(options.people.some(p=>p.id===fx.foreignProfile.id)).toBe(false);
    } finally {stub.mockRestore();}
    const b=await actualEditorBindings(); const input={...bookingInput([fx.ownProfile.id],{startsAt:"2026-10-12T04:00:00Z",endsAt:"2026-10-12T05:00:00Z"}),proposedCreateId:crypto.randomUUID()};
    const p=await b.preview(fx.adminClient,"create",input); expect(p.ok).toBe(true);
    if(p.ok)expect(p.data.warnings.every(w=>w.personLabels.includes(identity.label))).toBe(true);
  });
});
