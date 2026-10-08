"use client";
import { useActionState, useState, type ChangeEvent, type FormEvent } from "react";
import { saveResourceProfileAction, type ResourceActionState } from "@/features/resources/actions";
// Native time controls are minute-granular. The full PostgreSQL value remains in
// the hidden read-model payload and is retained by the server action when unchanged.
function timeForInput(value: string | undefined): string | undefined { return value?.slice(0, 5); }
const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"] as const;
const RESOURCE_INITIAL: ResourceActionState = { status: "idle", message: "" };
export function PersonSchedulePanel({ membershipId, inactive, profile, defaultSchedule, workRoles, resourceSaveFailureOnce }: { readonly membershipId: string; readonly inactive: boolean; readonly profile?: { readonly defaultWorkRoleId: string | null; readonly employmentPercentage: number | null; readonly shifts: readonly { readonly weekday:number;readonly start:string;readonly end:string;readonly breaks:readonly {readonly start:string;readonly end:string}[] }[]; readonly exceptions: readonly { readonly kind:string;readonly date:string;readonly start:string|null;readonly end:string|null }[]; readonly calendarDays: readonly { readonly date:string; readonly variant:string; readonly reductionPercent:number|null }[] } | null; readonly defaultSchedule: readonly { readonly weekday:number;readonly start:string;readonly end:string;readonly breaks:readonly {readonly start:string;readonly end:string}[] }[]; readonly workRoles: readonly { readonly id:string;readonly name:string }[]; readonly resourceSaveFailureOnce: boolean }) {
  const calendarDay = profile?.calendarDays.find((day) => day.variant === "reduced_capacity");
  const retryScenario = resourceSaveFailureOnce;
  const [state, action, pending] = useActionState(saveResourceProfileAction, RESOURCE_INITIAL);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const draftValue = (name: string, fallback?: string | number | null) => draft[name] ?? (fallback === undefined || fallback === null ? "" : String(fallback));
  const retainDraft = (event: FormEvent<HTMLFormElement>) => {
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(event.currentTarget).entries()) if (typeof value === "string") values[name] = value;
    setDraft(values);
  };
  const retainSelectDraft = (event: ChangeEvent<HTMLSelectElement>) => {
    const form = event.currentTarget.form;
    if (!form) return;
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(form).entries()) if (typeof value === "string") values[name] = value;
    setDraft(values);
  };
  return <section className="mt-6 rounded border p-4" aria-labelledby="resource-schedule-heading">
    <h2 id="resource-schedule-heading" className="font-semibold">Arbetstid och kapacitet</h2>
    <p data-testid="resource-profile-status" className="mt-1 text-sm">{inactive ? "Inaktiverad" : "Aktiv"}</p>
    <p className="mt-1 text-sm text-zinc-600">Schemat är ett kapacitetsunderlag. Bokning och omfördelning tillkommer senare.</p>
    <form action={action} onChange={retainDraft} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="membershipId" value={membershipId}/><input type="hidden" name="existingSchedule" value={JSON.stringify(profile?.shifts ?? defaultSchedule)}/><input type="hidden" name="existingExceptions" value={JSON.stringify(profile?.exceptions ?? [])}/><input type="hidden" name="existingCalendarDate" value={calendarDay?.date ?? ""}/><input type="hidden" name="resourceSaveFailureOnce" value={retryScenario ? "true" : "false"}/>
      <label>Standardroll<select name="defaultWorkRoleId" data-testid="resource-default-work-role" value={draftValue("defaultWorkRoleId", profile?.defaultWorkRoleId)} onChange={retainSelectDraft}><option value="">Ingen standardroll</option>{workRoles.map((role)=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <label>Anställningsgrad<input name="employmentPercentage" type="number" min="1" max="100" value={draftValue("employmentPercentage", profile?.employmentPercentage)}/></label>
      {WEEKDAYS.map((label, offset) => { const weekday = offset + 1; const shift = (profile?.shifts ?? defaultSchedule).find((candidate) => candidate.weekday === weekday); const pause = shift?.breaks[0]; return <fieldset key={weekday} className="contents"><legend className="sr-only">{label}</legend><label>{label} start<input name={`weekday${weekday}Start`} type="time" data-testid={`resource-weekday-${weekday}-start`} value={draftValue(`weekday${weekday}Start`, timeForInput(shift?.start))}/></label><label>{label} slut<input name={`weekday${weekday}End`} type="time" data-testid={`resource-weekday-${weekday}-end`} value={draftValue(`weekday${weekday}End`, timeForInput(shift?.end))}/></label><label>{label} rast start<input name={`weekday${weekday}BreakStart`} type="time" data-testid={`resource-break-${weekday}-start`} value={draftValue(`weekday${weekday}BreakStart`, timeForInput(pause?.start))}/></label><label>{label} rast slut<input name={`weekday${weekday}BreakEnd`} type="time" data-testid={`resource-break-${weekday}-end`} value={draftValue(`weekday${weekday}BreakEnd`, timeForInput(pause?.end))}/></label></fieldset>; })}
      <label>Personligt undantag<select name="personExceptionKind" value={draftValue("personExceptionKind", profile?.exceptions[0]?.kind)} onChange={retainSelectDraft}><option value="">Inget</option><option value="absence">Frånvaro</option><option value="sick_leave">Sjukfrånvaro</option><option value="leave">Ledighet</option><option value="training">Utbildning</option><option value="blocked_time">Spärrad tid</option></select></label>
      <label>Datum för personligt undantag<input name="personExceptionDate" type="date" data-testid="resource-person-exception-date" value={draftValue("personExceptionDate", profile?.exceptions[0]?.date)}/></label>
      <label>Start för personligt undantag<input name="personExceptionStart" type="time" value={draftValue("personExceptionStart", timeForInput(profile?.exceptions[0]?.start ?? undefined))}/></label><label>Slut för personligt undantag<input name="personExceptionEnd" type="time" value={draftValue("personExceptionEnd", timeForInput(profile?.exceptions[0]?.end ?? undefined))}/></label>
      <label>Undantagsdatum<input name="exceptionDate" type="date" data-testid="resource-exception-date" value={draftValue("exceptionDate", calendarDay?.date)}/></label>
      <label>Kalenderreduktion (%)<input name="calendarReduction" type="number" min="1" max="100" data-testid="resource-calendar-day-reduction" value={draftValue("calendarReduction", calendarDay?.reductionPercent)}/></label>
      {state.status === "error" && retryScenario ? <button type="submit" name="resourceFailureAttempt" value="retry" data-testid="resource-retry-save" disabled={pending}>{pending ? "Sparar…" : "Försök igen"}</button> : <button type="submit" name="resourceFailureAttempt" value="initial" data-testid="resource-save" disabled={pending}>{pending ? "Sparar…" : "Spara"}</button>}
    </form>
    {state.status === "error" && <p data-testid="resource-save-error" role="alert">{state.message}</p>}
    {state.status === "success" && <p data-testid="resource-save-status" role="status">{state.message}</p>}
  </section>;
}
