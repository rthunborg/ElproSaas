"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/crm/Dialog";
import type { BookingFacts } from "@/features/resources/booking-types";
import type { BookingEditorOptions } from "@/features/resources/booking-action-state";
import { previewBookingAction, saveBookingAction } from "@/features/resources/booking-actions";
import { prepareBookingTimes } from "@/features/resources/booking-editor-input";
import { BookingConflictPanel, advanceBookingPreview, type BookingPreviewDisplay } from "./BookingConflictPanel";

const fieldClass = "min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";
const buttonClass = "min-h-12 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60";
export type BookingPrefill = {readonly personId?: string; readonly startsAt?: string; readonly endsAt?: string};
export function bookingLocalInput(value: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(new Date(value)).map(p => [p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function BookingEditor({open, onClose, draft, options, bookingId, prefill, initialPreview}: {
  readonly open: boolean; readonly onClose: () => void; readonly draft: BookingFacts;
  readonly options: BookingEditorOptions; readonly bookingId?: string; readonly prefill?: BookingPrefill;
  readonly initialPreview?: BookingPreviewDisplay;
}) {
  const [facts, setFacts] = useState<BookingFacts>(() => ({...draft, startsAt: prefill?.startsAt ?? draft.startsAt, endsAt: prefill?.endsAt ?? draft.endsAt, assigneeIds: prefill?.personId ? [prefill.personId] : draft.assigneeIds}));
  const [start, setStart] = useState(() => bookingLocalInput(prefill?.startsAt ?? draft.startsAt));
  const [end, setEnd] = useState(() => bookingLocalInput(prefill?.endsAt ?? draft.endsAt));
  const [startChanged, setStartChanged] = useState(false);
  const [endChanged, setEndChanged] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [pending, setPending] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const attempted = useRef<Parameters<typeof saveBookingAction>[0] | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [preview, setPreview] = useState<BookingPreviewDisplay>(initialPreview ?? {requestId: "initial", status: "pending", warnings: [], availabilityLabel: "Okänd"});
  const [retry, setRetry] = useState(0);
  const [availability, setAvailability] = useState<readonly {personId: string; available: boolean}[]>([]);
  // Existing assignments remain visible/editable even if the person is no longer
  // offered for new bookings. SQL decides whether a fresh assignment is valid.
  const people = [...options.people, ...(bookingId ? draft.assigneeIds.filter(id => !options.people.some(person => person.id === id))
    .map(id => ({id, label: `Resursperson ${id.slice(0,8)} · nuvarande tilldelning`, defaultWorkRoleId: null, workRoleIds: [] as readonly string[]})) : [])];
  const receipt = useRef<string | null>(null);
  const sequence = useRef(0);
  const identity = useRef<{commandId: string; proposedBookingId: string} | null>(null);
  const proposedCreateId = useRef<string | null>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const discardReturnFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(pending);
  const dirtyRef = useRef(dirty && !success);
  useEffect(() => {closeRef.current = onClose; busyRef.current = pending || unresolved; dirtyRef.current = dirty && !success;}, [onClose, pending, unresolved, dirty, success]);
  useEffect(() => {
    if (!discard) return;
    discardReturnFocus.current = document.activeElement as HTMLElement | null;
    keepEditing.current?.focus();
    return () => {discardReturnFocus.current?.focus();};
  }, [discard]);
  function requestClose() { if (pending || unresolved) return; if (dirty && !success) setDiscard(true); else onClose(); }
  function change(patch: Partial<BookingFacts>) {
    if (pending || attempted.current) return;
    sequence.current += 1; receipt.current = null; setReviewed(false); setSelected([]); setReason("");
    setPreview(value => advanceBookingPreview({currentRequestId: value.requestId,preview: value,reviewed}, {kind: "candidateChanged",requestId: String(sequence.current)}).preview);
    setAvailability([]);
    setFacts(value => ({...value,...patch})); setDirty(true); setError(null);
    identity.current = null;
  }
  function candidate() {
    proposedCreateId.current ??= crypto.randomUUID();
    identity.current ??= {commandId: crypto.randomUUID(), proposedBookingId: proposedCreateId.current};
    return {...facts, ...prepareBookingTimes({original: facts, startChanged, endChanged, allDay: facts.allDay, startsAtLocal: start, endsAtLocal: end}), commandId: identity.current.commandId,
      ...(bookingId ? {bookingId} : {proposedBookingId: identity.current.proposedBookingId})};
  }
  function deliverPreview(current: number, value: BookingPreviewDisplay) {
    setPreview(previous => advanceBookingPreview({currentRequestId: String(sequence.current), preview: previous, reviewed: false},
      {kind: "response", requestId: String(current), preview: value}).preview);
  }
  useEffect(() => {
    if (!open || success || unresolved) return;
    const current = ++sequence.current;
    receipt.current = null;
    const timer = window.setTimeout(async () => {
      try {
        const result = await previewBookingAction(candidate());
        if (sequence.current !== current) return;
        if (result.status === "error") { deliverPreview(current, {requestId: String(current),status: "error", warnings: [], availabilityLabel: "Okänd", errorMessage: result.message}); return; }
        receipt.current = result.preview.receipt;
        setAvailability(result.preview.availability);
        deliverPreview(current, {requestId: String(current),status: "ready", warnings: result.preview.warnings, availabilityLabel: result.preview.availability.some(person => !person.available) ? "Upptagen" : "Tillgänglig"});
      } catch { if (sequence.current === current) deliverPreview(current, {requestId: String(current),status: "error",warnings: [],availabilityLabel: "Okänd",errorMessage: "Konfliktkontrollen kunde inte slutföras."}); }
    }, 250);
    return () => {window.clearTimeout(timer); sequence.current += 1;};
    // Each candidate change gets a new request identity; receipt stays in memory only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facts, start, end, startChanged, endChanged, retry, success, unresolved]);
  useEffect(() => {
    if (!open) return;
    const marker = crypto.randomUUID();
    history.pushState({...history.state, bookingEditor: marker}, "");
    const back = () => { history.pushState({...history.state, bookingEditor: marker}, ""); if (busyRef.current) return; if (dirtyRef.current) setDiscard(true); else closeRef.current(); };
    const unload = (event: BeforeUnloadEvent) => {if (dirtyRef.current || busyRef.current) {event.preventDefault(); event.returnValue = "";}};
    window.addEventListener("popstate", back); window.addEventListener("beforeunload", unload);
    return () => {window.removeEventListener("popstate", back); window.removeEventListener("beforeunload", unload); if (history.state?.bookingEditor === marker) history.back();};
  }, [open]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending || success || discard || (!attempted.current && (preview.status !== "ready" || !receipt.current))) return;
    if (!attempted.current && preview.warnings.length && (!reviewed || !reason.trim())) {setError("Granska aktuella varningar och ange en orsak."); return;}
    setPending(true); setError(null);
    try {
      const input = attempted.current ?? {...candidate(), editorReview: {receipt: receipt.current, decision: {acknowledged: preview.warnings.length > 0 && reviewed, reviewedLogicalIds: preview.warnings.map(w => w.logicalId), selectedLogicalIds: selected, reason: preview.warnings.length ? reason.trim() : ""}}};
      attempted.current = input;
      const result = await saveBookingAction(input);
      if (result.status === "success") {attempted.current = null; setUnresolved(false); setSuccess(true); setDirty(false);} else {
        setError(result.message);
        if (result.code === "SERVER_ERROR") setUnresolved(true);
        else {attempted.current = null; setUnresolved(false);}
        if (result.code === "PREVIEW_STALE") {setReviewed(false); setSelected([]); setReason(""); receipt.current = null; setPreview({requestId: "stale",status: "pending",warnings: [],availabilityLabel: "Okänd"}); setRetry(n => n+1);}
      }
    } catch {setUnresolved(true); setError("Bokningen kunde inte sparas. Behåll utkastet och försök igen.");} finally {setPending(false);}
  }
  function connection(name: "jobId" | "customerId" | "facilityId" | "contactId", value: string) {
    if (name === "jobId") {
      const job = options.jobs.find(item => item.id === value);
      change(job ? {jobId: job.id,customerId: job.customerId,facilityId: job.facilityId,contactId: job.contactId} : {jobId: null});
    } else if (name === "customerId") {
      change({customerId: value || null,jobId: null,facilityId: null,contactId: null});
    } else if (name === "facilityId") {
      const facility = options.facilities.find(item => item.id === value);
      change({facilityId: value || null,contactId: null,jobId: null,...(facility ? {customerId: facility.customerId} : {})});
    } else {
      const contact = options.contacts.find(item => item.id === value);
      change({contactId: value || null,jobId: null,...(contact ? {customerId: contact.customerId,
        facilityId: contact.facilityId ?? (contact.customerId === facts.customerId ? facts.facilityId : null)} : {})});
    }
  }
  const optional = (name: "jobId" | "customerId" | "facilityId" | "contactId", label: string, entries: readonly {id: string; label: string}[]) => <label className="space-y-1"><span className="text-sm font-medium">{label}</span><select name={name} data-testid={`booking-${name.replace("Id", "")}`} value={facts[name] ?? ""} className={fieldClass} onChange={e => connection(name, e.target.value)}><option value="">Ingen koppling</option>{facts[name] && !entries.some(item => item.id === facts[name]) && <option value={facts[name]!} disabled>Nuvarande koppling (ej tillgänglig för nya val) · {facts[name]}</option>}{entries.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>;
  return <Dialog open={open} onClose={requestClose} title={bookingId ? "Redigera bokning" : "Ny bokning"} busy={pending} variant="sheet">
    <form onSubmit={save} data-testid="booking-editor" className="space-y-5" aria-busy={pending}>
      <div data-testid="booking-editor-sheet" className="space-y-5"><div data-testid="booking-editor-scroll-body" className="space-y-5">
      {success ? <p role="status" data-testid="booking-save-status" className="rounded-md bg-green-50 p-3 text-green-900">Sparad i systemet</p> : <>
      <p data-testid="booking-unsent" className="text-sm text-zinc-600">Utkast ej skickat</p>
      {unresolved && <p role="status" data-testid="booking-unresolved-save">Sparresultatet är okänt. Försök igen med samma utkast innan du ändrar eller stänger bokningen.</p>}
      {options.error && <p role="alert">{options.error}</p>}
      <fieldset disabled={pending || unresolved} className="space-y-4"><legend className="font-semibold">Tilldelade</legend>
      <label className="block space-y-1"><span className="text-sm">Filtrera arbetsroll</span><select data-testid="booking-work-role-filter" className={fieldClass} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option value="">Alla arbetsroller</option>{options.workRoles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
      {people.filter(p => !roleFilter || p.defaultWorkRoleId === roleFilter || p.workRoleIds.includes(roleFilter) || facts.assigneeIds.includes(p.id)).map(p => <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm"><input name="assigneeIds" type="checkbox" value={p.id} data-testid={`booking-assignee-option-${p.id}`} checked={facts.assigneeIds.includes(p.id)} onChange={e => change({assigneeIds: e.target.checked ? [...facts.assigneeIds,p.id] : facts.assigneeIds.filter(id => id !== p.id)})} /><span>{p.label} · {preview.status === "ready" && availability.find(a => a.personId === p.id) ? availability.find(a => a.personId === p.id)!.available ? "Tillgänglig" : "Upptagen" : "Okänd"}</span></label>)}
      <label className="block space-y-1"><span>Arbetsroll</span><select name="workRoleId" data-testid="booking-work-role" className={fieldClass} value={facts.workRoleId ?? ""} onChange={e => change({workRoleId: e.target.value || null})}><option value="">Ingen arbetsroll</option>{options.workRoles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-3"><input name="allDay" data-testid="booking-all-day" type="checkbox" checked={facts.allDay} onChange={e => {if (!e.target.checked) {setStart(value => value.length === 10 ? `${value}T00:00` : value); setEnd(value => value.length === 10 ? `${value}T00:00` : value);} setStartChanged(true); setEndChanged(true); change({allDay: e.target.checked});}} />Heldag</label>
      <p className="text-xs text-zinc-600">Tid i Stockholm. För heldag är slutdatum den första dagen efter bokningen.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span>Start</span><input name="startsAt" data-testid="booking-start" type={facts.allDay ? "date" : "datetime-local"} className={fieldClass} value={facts.allDay ? start.slice(0,10) : start} onChange={e => {setStart(e.target.value); setStartChanged(true); change({});}} required /></label><label className="space-y-1"><span>Slut</span><input name="endsAt" data-testid="booking-end" type={facts.allDay ? "date" : "datetime-local"} className={fieldClass} value={facts.allDay ? end.slice(0,10) : end} onChange={e => {setEnd(e.target.value); setEndChanged(true); change({});}} required /></label></div>
      <div className="grid gap-3 sm:grid-cols-2">{optional("jobId","Jobb",options.jobs)}{optional("customerId","Kund",options.customers)}{optional("facilityId","Anläggning",options.facilities.filter(f => !facts.customerId || f.customerId === facts.customerId))}{optional("contactId","Kontakt",options.contacts.filter(c => (!facts.customerId || c.customerId === facts.customerId) && (!facts.facilityId || !c.facilityId || c.facilityId === facts.facilityId)))}</div>
      <label className="block space-y-1"><span>Beskrivning</span><textarea name="description" data-testid="booking-description" className={fieldClass} value={facts.description} onChange={e => change({description: e.target.value})} /></label>
      <label className="block space-y-1"><span>Status</span><select name="status" data-testid="booking-status" className={fieldClass} value={facts.status} onChange={e => change({status: e.target.value as BookingFacts["status"]})}><option value="planned">Planerad</option><option value="cancelled">Avbruten</option></select></label>
      </fieldset>
      <BookingConflictPanel preview={preview} onRetry={() => setRetry(n => n+1)} selected={selected} onSelect={pending || unresolved || discard ? undefined : (id, checked) => {setSelected(values => checked ? [...values,id] : values.filter(value => value !== id)); setDirty(true);}} />
      {preview.status === "ready" && preview.warnings.length > 0 && <fieldset disabled={pending || unresolved} className="space-y-3"><label className="flex min-h-11 items-center gap-3"><input type="checkbox" data-testid="booking-review-current-warnings" checked={reviewed} onChange={e => {setReviewed(e.target.checked); setDirty(true);}} />Jag har granskat samtliga aktuella varningar</label><label className="block space-y-1"><span>Orsak för att boka ändå</span><textarea data-testid="booking-override-reason" className={fieldClass} maxLength={2000} value={reason} onChange={e => {setReason(e.target.value); setDirty(true);}} /></label><p className="text-sm text-zinc-600">Endast valda konflikter accepteras. Övriga granskade konflikter förblir öppna.</p></fieldset>}
      {error && <p role="alert" data-testid="booking-save-error" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      </>}
      </div></div>
      {discard && <div role="alertdialog" aria-label="Kasta utkast?" data-testid="booking-discard-confirmation" className="space-y-3 rounded-md border border-amber-300 p-3"><p>Kasta osparade ändringar?</p><div className="flex flex-wrap gap-2"><button type="button" data-testid="booking-keep-editing" ref={keepEditing} className={buttonClass} onClick={() => setDiscard(false)}>Fortsätt redigera</button><button type="button" data-testid="booking-discard" className={buttonClass} disabled={pending || unresolved} onClick={() => {if (!pending && !attempted.current) onClose();}}>Kasta utkast</button></div></div>}
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-zinc-200 bg-white py-3"><button type="button" data-testid="booking-close" className={buttonClass} disabled={pending || unresolved} onClick={requestClose}>{success ? "Stäng" : "Avbryt"}</button>{!success && <button type="submit" data-testid={error ? "booking-retry" : "booking-save"} disabled={pending || discard || (!unresolved && preview.status !== "ready") || !!options.error} className={`${buttonClass} bg-blue-700 text-white`}>{pending ? "Sparar…" : error ? "Försök igen" : preview.warnings.length ? "Boka ändå" : "Spara bokning"}</button>}</div>
    </form>
  </Dialog>;
}
