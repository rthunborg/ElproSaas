"use client";

import { useActionState } from "react";

import { FormErrorSummary, SelectField, TextField } from "@/components/crm/FormField";
import { CALC_ACTION_INITIAL, isRetryableCalcError } from "@/features/calculations/action-state";
import { updateTaxInputAction } from "@/features/calculations/actions";
import { oreToKronorString } from "@/features/calculations/money-input";
import {
  GREEN_BASIS_METHODS,
  TAX_DEDUCTION_CHOICES,
  type GreenBasisMethod,
  type TaxDeductionChoice,
  type TaxInputSnapshotV2,
  type TaxPersonAllowanceSlot,
  type VatType,
} from "@/lib/money";

const VAT_LABELS: Record<VatType, string> = {
  STANDARD_VAT_25: "Standardmoms",
  REDUCED_VAT: "Reducerad moms",
  ZERO_RATED: "Momsfri (0 %)",
  REVERSE_CHARGE_CONSTRUCTION: "Omvänd betalningsskyldighet, bygg",
};
// The document field is an explicit reverse-charge applicability choice, not a
// second per-row VAT category. Standard and reverse may coexist in one document.
const VAT_OPTIONS = (["STANDARD_VAT_25", "REVERSE_CHARGE_CONSTRUCTION"] as const).map((value) => ({
  value,
  label: VAT_LABELS[value],
}));

const DEDUCTION_LABELS: Record<TaxDeductionChoice, string> = {
  NONE: "Inget avdrag",
  ROT: "ROT",
  GREEN: "Grön teknik",
  ROT_AND_GREEN: "ROT och grön teknik (separata arbeten)",
};
const DEDUCTION_OPTIONS = TAX_DEDUCTION_CHOICES.map((value) => ({
  value,
  label: DEDUCTION_LABELS[value],
}));

const BASIS_LABELS: Record<GreenBasisMethod, string> = {
  ACTUAL_ELIGIBLE_COSTS: "Faktiska stödberättigade kostnader",
  FIXED_PRICE_97_PERCENT: "97 % av äkta fastprisavtal",
};
const BASIS_OPTIONS = GREEN_BASIS_METHODS.map((value) => ({
  value,
  label: BASIS_LABELS[value],
}));

const EMPTY_TAX_INPUT: TaxInputSnapshotV2 = {
  schemaVersion: 2,
  documentVatType: "STANDARD_VAT_25",
  buyerVatNumber: null,
  deductionChoice: "NONE",
  paymentDate: null,
  finalPaymentDate: null,
  personAllowanceSlots: [],
  greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
  genuineFixedPrice: false,
  fixedPriceOre: null,
  fixedPriceCategorySplitOre: null,
};

function slotAt(input: TaxInputSnapshotV2, number: number): TaxPersonAllowanceSlot | undefined {
  return input.personAllowanceSlots.find((slot) => slot.slot === `PERSON_${number}`);
}

function oreValue(value: number | undefined | null): string {
  return value === undefined || value === null ? "" : oreToKronorString(value);
}

export function TaxSettingsPanel({
  calculationId,
  value,
}: {
  readonly calculationId: string;
  readonly value: TaxInputSnapshotV2 | null;
}) {
  const input = value ?? EMPTY_TAX_INPUT;
  const [state, action, pending] = useActionState(updateTaxInputAction, CALC_ACTION_INITIAL);
  const mine = state.form === "tax_input";
  const v = (field: string, fallback: string): string =>
    (mine && state.values[field] !== undefined ? state.values[field] : fallback) ?? fallback;
  const err = (field: string): string | undefined =>
    mine ? state.fieldErrors[field] : undefined;
  // Preserve every already-declared allowance slot. Two empty slots remain
  // visible for a new calculation; the parser accepts the full canonical 50.
  const highestExistingSlot = input.personAllowanceSlots.reduce((highest, slot) => {
    const parsed = /^PERSON_(\d+)$/.exec(slot.slot);
    return parsed === null ? highest : Math.max(highest, Number(parsed[1]));
  }, 0);
  const personCount = Math.min(50, Math.max(2, highestExistingSlot));
  const persons = Array.from({ length: personCount }, (_, index) => index + 1);

  return (
    <section
      data-testid="tax-document-settings"
      aria-labelledby="tax-document-settings-title"
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 id="tax-document-settings-title" className="text-base font-semibold text-zinc-900">
        Skatteinställningar
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Ange explicita moms- och avdragsfakta. Uppgifterna fryses när en offertversion skapas.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-4" noValidate>
        <input type="hidden" name="id" value={calculationId} />
        <FormErrorSummary message={mine ? state.formError : null} />
        {mine && state.status === "success" ? (
          <p role="status" className="text-sm text-green-800">
            Skatte- och momsuppgifterna har sparats.
          </p>
        ) : null}
        {mine && isRetryableCalcError(state) ? (
          <p role="status" className="text-sm text-amber-800">
            Ett tillfälligt fel inträffade. Försök igen.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            name="document_vat_type"
            label="Momshantering"
            options={[...VAT_OPTIONS]}
            defaultValue={v("document_vat_type", input.documentVatType)}
            error={err("document_vat_type")}
          />
          <TextField
            name="buyer_vat_number"
            label="Köparens momsregistreringsnummer"
            defaultValue={v("buyer_vat_number", input.buyerVatNumber ?? "")}
            error={err("buyer_vat_number")}
            autoComplete="off"
          />
          <SelectField
            name="deduction_choice"
            label="Skatteavdrag"
            options={[...DEDUCTION_OPTIONS]}
            defaultValue={v("deduction_choice", input.deductionChoice)}
            error={err("deduction_choice")}
          />
          <SelectField
            name="green_basis_method"
            label="Beräkningsgrund för grön teknik"
            options={[...BASIS_OPTIONS]}
            defaultValue={v("green_basis_method", input.greenBasisMethod)}
            error={err("green_basis_method")}
          />
          <TextField
            name="payment_date"
            label="Betalningsdatum för ROT"
            type="date"
            defaultValue={v("payment_date", input.paymentDate ?? "")}
            error={err("payment_date")}
          />
          <TextField
            name="final_payment_date"
            label="Slutbetalningsdatum för grön teknik"
            type="date"
            defaultValue={v("final_payment_date", input.finalPaymentDate ?? "")}
            error={err("final_payment_date")}
          />
        </div>

        <fieldset className="rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-sm font-medium text-zinc-800">Återstående utrymme per person</legend>
          <p className="mb-3 text-xs text-zinc-600">
            Använd endast neutrala platser som PERSON_1, PERSON_2 osv.; personnummer och namn lagras inte här.
          </p>
          {persons.map((number) => {
            const slot = slotAt(input, number);
            return (
              <div key={number} className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextField
                  name={`person_${number}_rot_remaining_kronor`}
                  label={`Person ${number}: ROT kvar (kr)`}
                  defaultValue={v(
                    `person_${number}_rot_remaining_kronor`,
                    oreValue(slot?.remainingRotAllowanceOre ?? slot?.remainingAllowanceOre),
                  )}
                  error={err(`person_${number}_rot_remaining_kronor`)}
                />
                <TextField
                  name={`person_${number}_combined_rot_rut_remaining_kronor`}
                  label={`Person ${number}: ROT/RUT kvar (kr)`}
                  defaultValue={v(
                    `person_${number}_combined_rot_rut_remaining_kronor`,
                    oreValue(slot?.remainingCombinedRotRutAllowanceOre),
                  )}
                  error={err(`person_${number}_combined_rot_rut_remaining_kronor`)}
                />
                <TextField
                  name={`person_${number}_green_remaining_kronor`}
                  label={`Person ${number}: grön teknik kvar (kr)`}
                  defaultValue={v(
                    `person_${number}_green_remaining_kronor`,
                    oreValue(slot?.remainingGreenAllowanceOre ?? slot?.remainingAllowanceOre),
                  )}
                  error={err(`person_${number}_green_remaining_kronor`)}
                />
              </div>
            );
          })}
        </fieldset>

        <fieldset className="rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-sm font-medium text-zinc-800">Fastprisunderlag (endast vid 97 %)</legend>
          <label className="mb-3 flex items-center gap-2 text-sm text-zinc-800">
            <input type="hidden" name="genuine_fixed_price" value="false" />
            <input
              type="checkbox"
              name="genuine_fixed_price"
              value="true"
              defaultChecked={
                v("genuine_fixed_price", String(input.genuineFixedPrice)) === "true"
              }
              className="size-4 rounded border-zinc-300"
            />
            Äkta fastprisavtal
          </label>
          {err("genuine_fixed_price") ? (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {err("genuine_fixed_price")}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              name="fixed_price_kronor"
              label="Fastpris totalt (kr)"
              defaultValue={v("fixed_price_kronor", oreValue(input.fixedPriceOre))}
              error={err("fixed_price_kronor")}
            />
            <TextField
              name="fixed_solar_kronor"
              label="Sol (kr)"
              defaultValue={v("fixed_solar_kronor", oreValue(input.fixedPriceCategorySplitOre?.SOLAR))}
              error={err("fixed_solar_kronor")}
            />
            <TextField
              name="fixed_storage_kronor"
              label="Lagring (kr)"
              defaultValue={v("fixed_storage_kronor", oreValue(input.fixedPriceCategorySplitOre?.STORAGE))}
              error={err("fixed_storage_kronor")}
            />
            <TextField
              name="fixed_charging_kronor"
              label="Laddning (kr)"
              defaultValue={v("fixed_charging_kronor", oreValue(input.fixedPriceCategorySplitOre?.CHARGING))}
              error={err("fixed_charging_kronor")}
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Sparar…" : "Spara skatte- och momsuppgifter"}
        </button>
      </form>
    </section>
  );
}
