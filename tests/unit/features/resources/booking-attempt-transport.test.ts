import assert from "node:assert/strict";
import { test } from "node:test";
import { retainUnresolvedBookingAttempt } from "@/features/resources/booking-editor-input";
import { BOOKING_ACTION_INPUT_LIMIT_BYTES, bookingActionFitsTransport } from "@/features/resources/booking-transport";
import { sealEditorReceipt, type EditorClaims } from "@/server/bookings/editor-preview";

test("Round2 authorization denial retains only a previously unresolved booking attempt",()=>{
  for(const code of ["UNAUTHENTICATED","TENANT_MEMBERSHIP_REQUIRED","PERMISSION_DENIED","TENANT_ACCESS_DENIED"]){
    assert.equal(retainUnresolvedBookingAttempt(code,true),true,code); assert.equal(retainUnresolvedBookingAttempt(code,false),false,code);
  }
  assert.equal(retainUnresolvedBookingAttempt("SERVER_ERROR",false),true);
  for(const code of ["PREVIEW_STALE","VALIDATION_FAILED","COMMAND_CONFLICT","BOOKING_CONFLICT_UNACKNOWLEDGED"])
    assert.equal(retainUnresolvedBookingAttempt(code,true),false,code);
});
test("Round2 synthetic envelope preflight counts UTF-8 bytes and rejects known oversize before submission",()=>{
  const value={description:"界".repeat(300000)}; assert.ok(bookingActionFitsTransport(value));
  assert.equal(bookingActionFitsTransport({description:"界".repeat(BOOKING_ACTION_INPUT_LIMIT_BYTES/3)}),false);
  const cycle:{self?:unknown}={}; cycle.self=cycle; assert.equal(bookingActionFitsTransport(cycle),false);
});
test("Round2 synthetic encoding guard cannot issue a receipt beyond the existing decoding bound",()=>{
  assert.throws(()=>sealEditorReceipt({groups:[], oversized:"x".repeat(750000)} as unknown as EditorClaims,"public-synthetic-unit-key"),
    (error:unknown)=>error instanceof Error&&"code"in error&&error.code==="VALIDATION_FAILED");
});
