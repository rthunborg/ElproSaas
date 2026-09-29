"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { RESOURCE_INITIAL, saveResourceProfileAction } from "@/features/resources/actions";
function timeForInput(value: string | undefined): string | undefined { return value?.slice(0, 5); }
export function PersonSchedulePanel({ membershipId, inactive, profile, workRoles }: { readonly membershipId: string; readonly inactive: boolean; readonly profile?: { readonly defaultWorkRoleId: string | null; readonly employmentPercentage: number | null; readonly shifts: readonly { readonly weekday:number;readonly start:string;readonly end:string;readonly breaks:readonly {readonly start:string;readonly end:string}[] }[]; readonly calendarDays: readonly { readonly date:string; readonly variant:string; readonly reductionPercent:number|null }[] } | null; readonly workRoles: readonly { readonly id:string;readonly name:string }[] }) {
  const monday = profile?.shifts.find((shift) => shift.weekday === 1);
  const mondayBreak = monday?.breaks[0];
  const calendarDay = profile?.calendarDays.find((day) => day.variant === "reduced_capacity");
  const searchParams = useSearchParams();
  const retryScenario = searchParams.get("resourceSaveFailure") === "once";
  const [state, action, pending] = useActionState(saveResourceProfileAction, RESOURCE_INITIAL);
  return <section className="mt-6 rounded border p-4" aria-labelledby="resource-schedule-heading">
    <h2 id="resource-schedule-heading" className="font-semibold">Arbetstid och kapacitet</h2>
    <p data-testid="resource-profile-status" className="mt-1 text-sm">{inactive ? "Inaktiverad" : "Aktiv"}</p>
    <p className="mt-1 text-sm text-zinc-600">Schemat är ett kapacitetsunderlag. Bokning och omfördelning tillkommer senare.</p>
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="membershipId" value={membershipId}/><input type="hidden" name="resourceSaveFailureOnce" value={retryScenario ? "true" : "false"}/>
      <label>Standardroll<select name="defaultWorkRoleId" data-testid="resource-default-work-role" defaultValue={profile?.defaultWorkRoleId ?? ""}><option value="">Ingen standardroll</option>{workRoles.map((role)=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <label>Anställningsgrad<input name="employmentPercentage" type="number" min="1" max="100" defaultValue={profile?.employmentPercentage ?? undefined}/></label>
      <label>Måndag start<input name="mondayStart" type="time" data-testid="resource-weekday-1-start" defaultValue={timeForInput(monday?.start)}/></label>
      <label>Måndag slut<input name="mondayEnd" type="time" data-testid="resource-weekday-1-end" defaultValue={timeForInput(monday?.end)}/></label>
      <label>Rast start<input name="mondayBreakStart" type="time" data-testid="resource-break-1-start" defaultValue={timeForInput(mondayBreak?.start)}/></label>
      <label>Rast slut<input name="mondayBreakEnd" type="time" data-testid="resource-break-1-end" defaultValue={timeForInput(mondayBreak?.end)}/></label>
      <label>Undantagsdatum<input name="exceptionDate" type="date" data-testid="resource-exception-date" defaultValue={calendarDay?.date}/></label>
      <label>Kalenderreduktion (%)<input name="calendarReduction" type="number" min="1" max="100" data-testid="resource-calendar-day-reduction" defaultValue={calendarDay?.reductionPercent ?? undefined}/></label>
      {state.status === "error" && retryScenario ? <button type="submit" name="resourceFailureAttempt" value="retry" data-testid="resource-retry-save" disabled={pending}>{pending ? "Sparar…" : "Försök igen"}</button> : <button type="submit" name="resourceFailureAttempt" value="initial" data-testid="resource-save" disabled={pending}>{pending ? "Sparar…" : "Spara"}</button>}
    </form>
    {state.status === "error" && <p data-testid="resource-save-error" role="alert">{state.message}</p>}
    {state.status === "success" && <p data-testid="resource-save-status" role="status">{state.message}</p>}
  </section>;
}
