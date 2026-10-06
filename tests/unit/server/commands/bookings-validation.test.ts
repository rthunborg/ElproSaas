import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCreateBooking, validateUpdateBooking } from "@/server/commands/bookings/validation";
const commandId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profile="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const second="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const input=()=>({commandId,startsAt:"2026-10-12T06:00:00Z",endsAt:"2026-10-12T14:00:00Z",assigneeIds:[profile]});
test("booking validates standalone defaults and update target",()=>{
 const created=validateCreateBooking(input()); assert.equal(created.ok,true);
 assert.equal(validateUpdateBooking(input()).ok,false);
 assert.equal(validateUpdateBooking({...input(),bookingId:second}).ok,true);
});
test("booking canonical instants preserve six fractional digits and sub-millisecond ranges",()=>{
 for(const [fraction,end] of [["1","6"],["12","65"],["123","654"],["1234","6543"],["12345","65432"],["123456","654321"]]){
  const first=validateCreateBooking({...input(),startsAt:`2026-10-12T06:00:00.${fraction}Z`,endsAt:`2026-10-12T06:00:00.${end}Z`});
  const equivalent=validateCreateBooking({...input(),startsAt:`2026-10-12T08:00:00.${fraction.padEnd(6,"0")}+02:00`,endsAt:`2026-10-12T08:00:00.${end.padEnd(6,"0")}+02:00`});
  assert.equal(first.ok,true);assert.equal(equivalent.ok,true);
  if(first.ok&&equivalent.ok){
   assert.equal(first.data.startsAt,`2026-10-12T06:00:00.${fraction.padEnd(6,"0")}Z`);
   assert.equal(first.data.endsAt,`2026-10-12T06:00:00.${end.padEnd(6,"0")}Z`);
   assert.deepEqual(first.data,equivalent.data);
  }
 }
 const tiny={...input(),startsAt:"2026-10-12T06:00:00.123456Z",endsAt:"2026-10-12T06:00:00.123457Z"};
 assert.equal(validateCreateBooking(tiny).ok,true);
 assert.equal(validateCreateBooking({...tiny,endsAt:tiny.startsAt}).ok,false);
 assert.equal(validateCreateBooking({...tiny,endsAt:"2026-10-12T06:00:00.123455Z"}).ok,false);
 assert.equal(validateCreateBooking({...input(),startsAt:"2026-03-28T23:00:00.000001Z",endsAt:"2026-03-29T22:00:00Z",allDay:true}).ok,false);
});
test("booking canonicalization normalizes UUIDs, equivalent instants, null links and assignee permutations",()=>{
 const first=validateCreateBooking({...input(),assigneeIds:[profile,second]});
 const equivalent=validateCreateBooking({...input(),commandId:commandId.toUpperCase(),startsAt:"2026-10-12T08:00:00+02:00",endsAt:"2026-10-12T16:00:00+02:00",assigneeIds:[second.toUpperCase(),profile.toUpperCase()],customerId:null,facilityId:null,contactId:null,workRoleId:null,jobId:null});
 assert.equal(first.ok,true); assert.equal(equivalent.ok,true);
 if(first.ok&&equivalent.ok)assert.deepEqual(equivalent.data,first.data);
});
test("booking rejects untrusted authority, malformed links, duplicate assignees and fabricated recurrence",()=>{
 for(const patch of [{tenantId:profile},{actorId:profile},{conflicts:[]},{digest:"fabricated"},{acceptanceReason:"override"},{seriesId:second},{occurrenceIndex:0},{isException:true},{commandId:"bad"},{assigneeIds:[]},{assigneeIds:[profile,profile.toUpperCase()]},{assigneeIds:[null]},{customerId:"bad"},{facilityId:42},{allDay:"true"},{status:"completed"},{description:"x".repeat(4001)}])
  assert.equal(validateCreateBooking({...input(),...patch}).ok,false,JSON.stringify(patch));
});
test("booking rejects invalid and nonpositive explicit-zone time ranges",()=>{
 for(const patch of [{endsAt:"2026-10-12T06:00:00Z"},{endsAt:"2026-10-12T05:00:00Z"},{startsAt:"2026-10-12T06:00:00"},{startsAt:"2026-02-30T06:00:00Z"},{endsAt:"infinity"}])
  assert.equal(validateCreateBooking({...input(),...patch}).ok,false,JSON.stringify(patch));
});
test("booking all-day validation uses Stockholm midnight across DST and excludes UTC-midnight mistakes",()=>{
 for(const [startsAt,endsAt] of [["2026-03-28T23:00:00Z","2026-03-29T22:00:00Z"],["2026-10-24T22:00:00Z","2026-10-25T23:00:00Z"]])
  assert.equal(validateCreateBooking({...input(),startsAt,endsAt,allDay:true}).ok,true);
 assert.equal(validateCreateBooking({...input(),startsAt:"2026-03-29T00:00:00Z",endsAt:"2026-03-30T00:00:00Z",allDay:true}).ok,false);
});
