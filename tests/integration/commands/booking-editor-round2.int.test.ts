import { expect, test } from "vitest";
import { withConflictFixture } from "../../support/booking-conflicts-atdd";
import { bookingInput, bookingSnapshot } from "../../support/bookings-atdd";
import { actualEditorBindings } from "../../support/booking-editor-production";
import { adminQuery } from "../../factories/admin-sql";

for(const change of ["archived-profile","disabled-membership"] as const) {
  test("Round2 fresh preview denies "+change+" but existing assignment retains its checked exception",async()=>{
    await withConflictFixture(async fx=>{
      const b=await actualEditorBindings(); const s=await b.seedConflictFree(fx); const p=await b.preview(fx.adminClient,"create",s.input);
      expect(p.ok).toBe(true); if(!p.ok)throw new Error(p.code);
      const saved=await b.save(fx.adminClient,"create",{...s.input,decision:{acknowledged:false,reviewedLogicalIds:[],selectedLogicalIds:[],reason:"",receipt:p.data.receipt}},crypto.randomUUID());
      expect(saved.ok).toBe(true); if(!saved.ok)throw new Error(saved.code);
      if(change==="archived-profile")await adminQuery("update public.person_profiles set archived_at=statement_timestamp() where id=$1 and tenant_id=$2",[fx.ownProfile.id,fx.base.tenantA.id]);
      else await adminQuery("update public.tenant_memberships set status='disabled' where id=$1 and tenant_id=$2",[fx.ownProfile.membershipId,fx.base.tenantA.id]);
      const before=await bookingSnapshot(fx.tenantIds);
      const fresh={...s.input,commandId:crypto.randomUUID(),proposedCreateId:crypto.randomUUID()};
      expect(await b.preview(fx.adminClient,"create",fresh)).toMatchObject({ok:false,code:"TENANT_ACCESS_DENIED"});
      const existing={...s.input,proposedCreateId:undefined,bookingId:saved.data.bookingId,commandId:crypto.randomUUID(),description:"Retained existing assignment"};
      expect((await b.preview(fx.adminClient,"update",existing)).ok).toBe(true);
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
}
test("Round2 actual warnings distinguish collision UUIDs sharing the first eight characters",async()=>{
  await withConflictFixture(async fx=>{
    const prefix=crypto.randomUUID().slice(0,30), peers=[prefix+"000001",prefix+"000002"];
    await adminQuery(`insert into public.bookings(id,tenant_id,starts_at,ends_at,description,create_command_id,create_payload_digest,create_result)
      select id,$2,'2026-10-12T06:00:00Z','2026-10-12T06:30:00Z','Scoped same-prefix fixture',gen_random_uuid(),repeat('a',64),jsonb_build_object('bookingId',id::text) from unnest($1::uuid[]) id`,[peers,fx.base.tenantA.id]);
    await adminQuery("insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) select $1,id,$3 from unnest($2::uuid[]) id",[fx.base.tenantA.id,peers,fx.ownProfile.id]);
    const b=await actualEditorBindings(), before=await bookingSnapshot(fx.tenantIds);
    const p=await b.preview(fx.adminClient,"create",{...bookingInput([fx.ownProfile.id],{startsAt:"2026-10-12T06:00:00Z",endsAt:"2026-10-12T06:30:00Z"}),proposedCreateId:crypto.randomUUID()});
    expect(p.ok).toBe(true); if(!p.ok)throw new Error(p.code);
    const warnings=(p.data.rawBrowserPayload as {preview:{warnings:{bookingLabels:string[]}[]}}).preview.warnings;
    const labels=warnings.flatMap(w=>w.bookingLabels); expect(labels).toContain("Bokning "+peers[0]);expect(labels).toContain("Bokning "+peers[1]);
    expect(new Set(labels.filter(label=>label.startsWith("Bokning "))).size).toBe(2);
    expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
  });
});
