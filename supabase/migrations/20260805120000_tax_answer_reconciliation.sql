-- ============================================================================
-- Story 10.6 — Tax answer reconciliation.
-- Forward-only additive migration; no historical migration is rewritten and no
-- tenant table is introduced. Historical calculation/quote snapshots remain valid.
-- ============================================================================

-- JSONB CHECK expressions are three-valued: a missing/null key can otherwise turn
-- a predicate into SQL NULL, which CHECK accepts. These immutable validators always
-- return a concrete boolean and catch cast failures, so malformed/partial V2 data is
-- rejected instead of slipping through a fail-open NULL result.
create or replace function public.is_story_10_6_ore(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_value numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then
    return false;
  end if;
  v_value := (p_value #>> '{}')::numeric;
  return v_value = trunc(v_value)
     and v_value >= 0
     and v_value <= 9007199254740991;
exception when others then
  return false;
end;
$$;

create or replace function public.is_story_10_6_tax_policy_snapshot(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return coalesce(
    jsonb_typeof(p_value) = 'object'
    and p_value ?& array[
      'id', 'validFrom', 'validTo', 'resolvingDate', 'resolvingFact', 'values'
    ]
    and jsonb_typeof(p_value -> 'id') = 'string'
    and length(p_value ->> 'id') between 1 and 128
    and p_value ->> 'id' = 'SE-TAX-2026-v1'
    and jsonb_typeof(p_value -> 'validFrom') = 'string'
    and (p_value ->> 'validFrom') ~ '^\d{4}-\d{2}-\d{2}$'
    and p_value ->> 'validFrom' = '2026-01-01'
    and jsonb_typeof(p_value -> 'validTo') in ('string', 'null')
    and (
      jsonb_typeof(p_value -> 'validTo') = 'null'
      or (p_value ->> 'validTo') ~ '^\d{4}-\d{2}-\d{2}$'
    )
    and p_value ->> 'validTo' = '2027-01-01'
    and jsonb_typeof(p_value -> 'resolvingDate') = 'string'
    and (p_value ->> 'resolvingDate') ~ '^\d{4}-\d{2}-\d{2}$'
    and (p_value ->> 'resolvingDate')::date >= (p_value ->> 'validFrom')::date
    and (
      jsonb_typeof(p_value -> 'validTo') = 'null'
      or (p_value ->> 'resolvingDate')::date < (p_value ->> 'validTo')::date
    )
    and p_value ->> 'resolvingFact' in (
      'QUOTE_CAPTURE_DATE', 'ROT_PAYMENT_DATE', 'GREEN_FINAL_PAYMENT_DATE'
    )
    and jsonb_typeof(p_value -> 'values') = 'object'
    and (p_value -> 'values') ?& array['vat', 'rot', 'green']
    and jsonb_typeof(p_value #> array['values', 'vat']) = 'object'
    and jsonb_typeof(p_value #> array['values', 'vat', 'standardRateBp']) = 'number'
    and (p_value #>> array['values', 'vat', 'standardRateBp'])::numeric
      = trunc((p_value #>> array['values', 'vat', 'standardRateBp'])::numeric)
    and (p_value #>> array['values', 'vat', 'standardRateBp'])::numeric between 0 and 10000
    and (p_value #>> array['values', 'vat', 'standardRateBp'])::numeric = 2500
    and jsonb_typeof(p_value #> array['values', 'rot']) = 'object'
    and (p_value #> array['values', 'rot']) ?& array[
      'rateBp', 'maxPerPersonYearOre', 'combinedRotRutMaxPerPersonYearOre'
    ]
    and jsonb_typeof(p_value #> array['values', 'rot', 'rateBp']) = 'number'
    and (p_value #>> array['values', 'rot', 'rateBp'])::numeric
      = trunc((p_value #>> array['values', 'rot', 'rateBp'])::numeric)
    and (p_value #>> array['values', 'rot', 'rateBp'])::numeric between 0 and 10000
    and (p_value #>> array['values', 'rot', 'rateBp'])::numeric = 3000
    and public.is_story_10_6_ore(p_value #> array['values', 'rot', 'maxPerPersonYearOre'])
    and (p_value #>> array['values', 'rot', 'maxPerPersonYearOre'])::numeric = 5000000
    and public.is_story_10_6_ore(
      p_value #> array['values', 'rot', 'combinedRotRutMaxPerPersonYearOre']
    )
    and (p_value #>> array['values', 'rot', 'combinedRotRutMaxPerPersonYearOre'])::numeric
      = 7500000
    and jsonb_typeof(p_value #> array['values', 'green']) = 'object'
    and (p_value #> array['values', 'green']) ?& array[
      'rateBpByCategory', 'maxPerPersonYearOre', 'defaultBasisMethod',
      'fixedPriceEligibleShareBp'
    ]
    and jsonb_typeof(p_value #> array['values', 'green', 'rateBpByCategory']) = 'object'
    and (p_value #> array['values', 'green', 'rateBpByCategory'])
      ?& array['SOLAR', 'STORAGE', 'CHARGING']
    and jsonb_typeof(p_value #> array['values', 'green', 'rateBpByCategory', 'SOLAR']) = 'number'
    and jsonb_typeof(p_value #> array['values', 'green', 'rateBpByCategory', 'STORAGE']) = 'number'
    and jsonb_typeof(p_value #> array['values', 'green', 'rateBpByCategory', 'CHARGING']) = 'number'
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'SOLAR'])::numeric
      = trunc((p_value #>> array['values', 'green', 'rateBpByCategory', 'SOLAR'])::numeric)
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'STORAGE'])::numeric
      = trunc((p_value #>> array['values', 'green', 'rateBpByCategory', 'STORAGE'])::numeric)
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'CHARGING'])::numeric
      = trunc((p_value #>> array['values', 'green', 'rateBpByCategory', 'CHARGING'])::numeric)
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'SOLAR'])::numeric between 0 and 10000
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'SOLAR'])::numeric = 1500
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'STORAGE'])::numeric between 0 and 10000
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'STORAGE'])::numeric = 5000
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'CHARGING'])::numeric between 0 and 10000
    and (p_value #>> array['values', 'green', 'rateBpByCategory', 'CHARGING'])::numeric = 5000
    and public.is_story_10_6_ore(
      p_value #> array['values', 'green', 'maxPerPersonYearOre']
    )
    and (p_value #>> array['values', 'green', 'maxPerPersonYearOre'])::numeric = 5000000
    and jsonb_typeof(p_value #> array['values', 'green', 'defaultBasisMethod']) = 'string'
    and (p_value #>> array['values', 'green', 'defaultBasisMethod']) in (
      'ACTUAL_ELIGIBLE_COSTS', 'FIXED_PRICE_97_PERCENT'
    )
    and (p_value #>> array['values', 'green', 'defaultBasisMethod'])
      = 'ACTUAL_ELIGIBLE_COSTS'
    and jsonb_typeof(p_value #> array['values', 'green', 'fixedPriceEligibleShareBp']) = 'number'
    and (p_value #>> array['values', 'green', 'fixedPriceEligibleShareBp'])::numeric
      = trunc((p_value #>> array['values', 'green', 'fixedPriceEligibleShareBp'])::numeric)
    and (p_value #>> array['values', 'green', 'fixedPriceEligibleShareBp'])::numeric
      between 0 and 10000
    and (p_value #>> array['values', 'green', 'fixedPriceEligibleShareBp'])::numeric = 9700,
    false
  );
exception when others then
  return false;
end;
$$;

create or replace function public.is_story_10_6_buyer_vat_number(p_value text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    p_value ~ '^SE\d{12}$'
    or (
      left(p_value, 2) in (
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI',
        'FR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
        'SI', 'SK', 'XI'
      )
      and p_value ~ '^[A-Z]{2}[A-Z0-9]{8,12}$'
    ),
    false
  )
$$;

create or replace function public.is_story_10_6_calendar_date(p_value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  return to_char(
    make_date(
      substring(p_value from 1 for 4)::integer,
      substring(p_value from 6 for 2)::integer,
      substring(p_value from 9 for 2)::integer
    ),
    'YYYY-MM-DD'
  ) = p_value;
exception when others then
  return false;
end;
$$;

create or replace function public.is_story_10_6_tax_input_v2(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_slot jsonb;
  v_category text;
  v_split_total numeric := 0;
  v_seen_slots text[] := array[]::text[];
  v_has_rot_slot boolean := false;
  v_has_green_slot boolean := false;
begin
  if p_value is null
     or jsonb_typeof(p_value) <> 'object'
     or not (p_value ?& array[
       'schemaVersion', 'documentVatType', 'buyerVatNumber', 'deductionChoice',
       'paymentDate', 'finalPaymentDate', 'personAllowanceSlots',
       'greenBasisMethod', 'genuineFixedPrice', 'fixedPriceOre',
       'fixedPriceCategorySplitOre'
     ]) then
    return false;
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_value) as key
    where key not in (
      'schemaVersion', 'documentVatType', 'buyerVatNumber', 'deductionChoice',
      'paymentDate', 'finalPaymentDate', 'personAllowanceSlots',
      'greenBasisMethod', 'genuineFixedPrice', 'fixedPriceOre',
      'fixedPriceCategorySplitOre'
    )
  ) then
    return false;
  end if;

  if jsonb_typeof(p_value -> 'schemaVersion') <> 'number'
     or (p_value ->> 'schemaVersion')::numeric <> 2
     or p_value ->> 'documentVatType' not in ('STANDARD_VAT_25', 'REVERSE_CHARGE_CONSTRUCTION')
     or p_value ->> 'deductionChoice' not in (
       'NONE', 'ROT', 'GREEN', 'ROT_AND_GREEN'
     )
     or p_value ->> 'greenBasisMethod' not in (
       'ACTUAL_ELIGIBLE_COSTS', 'FIXED_PRICE_97_PERCENT'
     )
     or jsonb_typeof(p_value -> 'genuineFixedPrice') <> 'boolean'
     or jsonb_typeof(p_value -> 'buyerVatNumber') not in ('string', 'null')
     or jsonb_typeof(p_value -> 'paymentDate') not in ('string', 'null')
     or jsonb_typeof(p_value -> 'finalPaymentDate') not in ('string', 'null')
     or jsonb_typeof(p_value -> 'personAllowanceSlots') <> 'array'
     or jsonb_array_length(p_value -> 'personAllowanceSlots') > 50
     or jsonb_typeof(p_value -> 'fixedPriceOre') not in ('number', 'null')
     or jsonb_typeof(p_value -> 'fixedPriceCategorySplitOre') not in ('object', 'null') then
    return false;
  end if;

  if jsonb_typeof(p_value -> 'buyerVatNumber') = 'string'
     and not public.is_story_10_6_buyer_vat_number(p_value ->> 'buyerVatNumber') then
    return false;
  end if;
  if jsonb_typeof(p_value -> 'paymentDate') = 'string'
     and not public.is_story_10_6_calendar_date(p_value ->> 'paymentDate') then
    return false;
  end if;
  if jsonb_typeof(p_value -> 'finalPaymentDate') = 'string'
     and not public.is_story_10_6_calendar_date(p_value ->> 'finalPaymentDate') then
    return false;
  end if;
  if p_value ->> 'deductionChoice' in ('ROT', 'ROT_AND_GREEN')
     and jsonb_typeof(p_value -> 'paymentDate') <> 'string' then
    return false;
  end if;
  if p_value ->> 'deductionChoice' in ('GREEN', 'ROT_AND_GREEN')
     and jsonb_typeof(p_value -> 'finalPaymentDate') <> 'string' then
    return false;
  end if;
  if p_value ->> 'deductionChoice' <> 'NONE'
     and jsonb_array_length(p_value -> 'personAllowanceSlots') = 0 then
    return false;
  end if;

  for v_slot in
    select value from jsonb_array_elements(p_value -> 'personAllowanceSlots')
  loop
    if jsonb_typeof(v_slot) <> 'object'
       or jsonb_typeof(v_slot -> 'slot') <> 'string'
       or not ((v_slot ->> 'slot') ~ '^(PERSON_([1-9]|[1-4][0-9]|50)|(person|slot|declared|dated)_[a-z0-9_]{1,32})$')
       or exists (select 1 from jsonb_object_keys(v_slot) as key where key not in (
         'slot', 'remainingAllowanceOre', 'remainingRotAllowanceOre',
         'remainingCombinedRotRutAllowanceOre', 'remainingGreenAllowanceOre'
       )) then
      return false;
    end if;
    if (v_slot ->> 'slot') = any(v_seen_slots) then
      return false;
    end if;
    v_seen_slots := array_append(v_seen_slots, v_slot ->> 'slot');
    if v_slot ? 'remainingAllowanceOre'
       and not public.is_story_10_6_ore(v_slot -> 'remainingAllowanceOre') then
      return false;
    end if;
    if v_slot ? 'remainingRotAllowanceOre'
       and not public.is_story_10_6_ore(v_slot -> 'remainingRotAllowanceOre') then
      return false;
    end if;
    if v_slot ? 'remainingCombinedRotRutAllowanceOre'
       and not public.is_story_10_6_ore(v_slot -> 'remainingCombinedRotRutAllowanceOre') then
      return false;
    end if;
    if v_slot ? 'remainingGreenAllowanceOre'
       and not public.is_story_10_6_ore(v_slot -> 'remainingGreenAllowanceOre') then
      return false;
    end if;
    if v_slot ? 'remainingRotAllowanceOre'
       and not (v_slot ? 'remainingCombinedRotRutAllowanceOre')
       and not (v_slot ? 'remainingAllowanceOre') then
      return false;
    end if;
    if v_slot ? 'remainingAllowanceOre' or v_slot ? 'remainingRotAllowanceOre' then
      v_has_rot_slot := true;
    end if;
    if v_slot ? 'remainingAllowanceOre' or v_slot ? 'remainingGreenAllowanceOre' then
      v_has_green_slot := true;
    end if;
  end loop;
  if p_value ->> 'deductionChoice' in ('ROT', 'ROT_AND_GREEN')
     and not v_has_rot_slot then
    return false;
  end if;
  if p_value ->> 'deductionChoice' in ('GREEN', 'ROT_AND_GREEN')
     and not v_has_green_slot then
    return false;
  end if;

  if jsonb_typeof(p_value -> 'fixedPriceOre') = 'number'
     and not public.is_story_10_6_ore(p_value -> 'fixedPriceOre') then
    return false;
  end if;
  if jsonb_typeof(p_value -> 'fixedPriceCategorySplitOre') = 'object' then
    if not ((p_value -> 'fixedPriceCategorySplitOre') ?& array['SOLAR', 'STORAGE', 'CHARGING']) then
      return false;
    end if;
    if exists (
      select 1 from jsonb_object_keys(p_value -> 'fixedPriceCategorySplitOre') as key
      where key not in ('SOLAR', 'STORAGE', 'CHARGING')
    ) then
      return false;
    end if;
    foreach v_category in array array['SOLAR', 'STORAGE', 'CHARGING']
    loop
      if not public.is_story_10_6_ore(p_value #> array['fixedPriceCategorySplitOre', v_category]) then
        return false;
      end if;
      v_split_total := v_split_total
        + (p_value #>> array['fixedPriceCategorySplitOre', v_category])::numeric;
    end loop;
  end if;

  if p_value ->> 'greenBasisMethod' = 'FIXED_PRICE_97_PERCENT' then
    if p_value ->> 'deductionChoice' not in ('GREEN', 'ROT_AND_GREEN')
       or (p_value ->> 'genuineFixedPrice')::boolean is not true
       or not public.is_story_10_6_ore(p_value -> 'fixedPriceOre')
       or jsonb_typeof(p_value -> 'fixedPriceCategorySplitOre') <> 'object'
       or v_split_total <> (p_value ->> 'fixedPriceOre')::numeric then
      return false;
    end if;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.is_story_10_6_tax_answer_v2(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_value jsonb;
  v_category text;
  v_classification text;
  v_bucket text;
  v_has_reverse boolean := false;
  v_sum_net bigint := 0;
  v_sum_vat bigint := 0;
  v_sum_gross bigint := 0;
  v_sum_alloc bigint := 0;
  v_sum_calculated bigint := 0;
  v_sum_claim bigint := 0;
  v_policy_id text;
  v_rule_id text;
  v_seen_rule_ids text[] := array[]::text[];
  v_expected_rule_ids text[] := array[]::text[];
  v_distinct_expected_rule_ids text[] := array[]::text[];
  v_seen_slots text[] := array[]::text[];
  v_category_key text;
  v_seen_category_keys text[] := array[]::text[];
  v_labor_classification text;
  v_material_classification text;
  v_classified_green_gross numeric;
  v_expected_green_basis numeric;
  v_expected_calculated numeric;
  v_expected_claim numeric;
  v_policy_rate numeric;
begin
  if p_value is null
     or jsonb_typeof(p_value) <> 'object'
     or not (p_value ?& array[
       'schemaVersion', 'taxRuleVersions', 'vatPolicy', 'documentVatType', 'buyerVatNumber',
       'reverseChargeApplied', 'deductionChoice', 'categories',
       'netByDeductionClassification', 'vatByDeductionClassification',
       'summaries', 'rot', 'green', 'netOre', 'vatOre', 'grossOre',
       'calculatedDeductionOre', 'claimDeductionOre', 'deductionOre', 'payableOre'
     ]) then
    return false;
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_value) as key
    where key not in (
      'schemaVersion', 'taxRuleVersions', 'vatPolicy', 'documentVatType', 'buyerVatNumber',
      'reverseChargeApplied', 'deductionChoice', 'categories',
      'netByDeductionClassification', 'vatByDeductionClassification', 'summaries', 'rot', 'green',
      'netOre', 'vatOre', 'grossOre', 'calculatedDeductionOre', 'claimDeductionOre',
      'deductionOre', 'payableOre'
    )
  ) then
    return false;
  end if;
  if jsonb_typeof(p_value -> 'schemaVersion') <> 'number'
     or (p_value ->> 'schemaVersion')::numeric <> 2
     or jsonb_typeof(p_value -> 'taxRuleVersions') <> 'array'
     or jsonb_array_length(p_value -> 'taxRuleVersions') = 0
     or jsonb_array_length(p_value -> 'taxRuleVersions') > 3
     or not public.is_story_10_6_tax_policy_snapshot(p_value -> 'vatPolicy')
     or p_value #>> array['vatPolicy', 'resolvingFact'] <> 'QUOTE_CAPTURE_DATE'
     or p_value ->> 'documentVatType' not in ('STANDARD_VAT_25', 'REVERSE_CHARGE_CONSTRUCTION')
     or jsonb_typeof(p_value -> 'buyerVatNumber') not in ('string', 'null')
     or jsonb_typeof(p_value -> 'reverseChargeApplied') <> 'boolean'
     or p_value ->> 'deductionChoice' not in ('NONE', 'ROT', 'GREEN', 'ROT_AND_GREEN')
     or jsonb_typeof(p_value -> 'categories') <> 'array'
     or jsonb_array_length(p_value -> 'categories') > 4
     or jsonb_typeof(p_value -> 'netByDeductionClassification') <> 'object'
     or jsonb_typeof(p_value -> 'vatByDeductionClassification') <> 'object'
     or jsonb_typeof(p_value -> 'summaries') <> 'object'
     or jsonb_typeof(p_value -> 'rot') <> 'object'
     or jsonb_typeof(p_value -> 'green') <> 'object' then
    return false;
  end if;

  for v_value in select value from jsonb_array_elements(p_value -> 'taxRuleVersions')
  loop
    if jsonb_typeof(v_value) <> 'string' or length(v_value #>> '{}') not between 1 and 128 then
      return false;
    end if;
    v_rule_id := v_value #>> '{}';
    if v_rule_id = any(v_seen_rule_ids) then
      return false;
    end if;
    v_seen_rule_ids := array_append(v_seen_rule_ids, v_rule_id);
  end loop;
  v_policy_id := p_value #>> array['vatPolicy', 'id'];
  v_expected_rule_ids := array_append(v_expected_rule_ids, v_policy_id);
  if not ((p_value -> 'taxRuleVersions') @> jsonb_build_array(v_policy_id)) then
    return false;
  end if;

  foreach v_bucket in array array[
    'netOre', 'vatOre', 'grossOre', 'calculatedDeductionOre',
    'claimDeductionOre', 'deductionOre', 'payableOre'
  ]
  loop
    if not public.is_story_10_6_ore(p_value -> v_bucket) then
      return false;
    end if;
  end loop;

  for v_value in select value from jsonb_array_elements(p_value -> 'categories')
  loop
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['vatType', 'rateBp', 'netOre', 'vatOre', 'grossOre'])
       or v_value ->> 'vatType' not in (
         'STANDARD_VAT_25', 'REDUCED_VAT', 'ZERO_RATED',
         'REVERSE_CHARGE_CONSTRUCTION'
       )
       or jsonb_typeof(v_value -> 'rateBp') <> 'number'
       or (v_value ->> 'rateBp')::numeric <> trunc((v_value ->> 'rateBp')::numeric)
       or (v_value ->> 'rateBp')::numeric not between 0 and 10000
       or (v_value ->> 'vatType' = 'STANDARD_VAT_25'
           and (v_value ->> 'rateBp')::numeric not in (0, 2500))
       or (v_value ->> 'vatType' = 'REVERSE_CHARGE_CONSTRUCTION'
           and (v_value ->> 'rateBp')::numeric not in (0, 2500))
       or (v_value ->> 'vatType' = 'ZERO_RATED'
           and (v_value ->> 'rateBp')::numeric <> 0)
       or (v_value ->> 'vatType' = 'REDUCED_VAT'
           and (v_value ->> 'rateBp')::numeric not in (600, 1200))
       or not public.is_story_10_6_ore(v_value -> 'netOre')
       or not public.is_story_10_6_ore(v_value -> 'vatOre')
       or not public.is_story_10_6_ore(v_value -> 'grossOre')
       or (v_value ->> 'grossOre')::bigint
          <> (v_value ->> 'netOre')::bigint + (v_value ->> 'vatOre')::bigint then
      return false;
    end if;
    if v_value ->> 'vatType' = 'REVERSE_CHARGE_CONSTRUCTION' then
      v_has_reverse := true;
      -- Keep the nominal/underlying VAT rate as part of category identity; reverse
      -- charge changes the seller VAT to zero, not the stored category rate.
      if (v_value ->> 'vatOre')::bigint <> 0 then
        return false;
      end if;
    elsif (v_value ->> 'vatOre')::numeric <> floor(
      ((v_value ->> 'netOre')::numeric * (v_value ->> 'rateBp')::numeric + 5000) / 10000
    ) then
      return false;
    end if;
    v_category_key := (v_value ->> 'vatType') || ':' || (v_value ->> 'rateBp');
    if v_category_key = any(v_seen_category_keys) then
      return false;
    end if;
    v_seen_category_keys := array_append(v_seen_category_keys, v_category_key);
    v_sum_net := v_sum_net + (v_value ->> 'netOre')::bigint;
    v_sum_vat := v_sum_vat + (v_value ->> 'vatOre')::bigint;
    v_sum_gross := v_sum_gross + (v_value ->> 'grossOre')::bigint;
  end loop;
  if v_sum_net <> (p_value ->> 'netOre')::bigint
     or v_sum_vat <> (p_value ->> 'vatOre')::bigint
     or v_sum_gross <> (p_value ->> 'grossOre')::bigint
     or v_sum_gross <> v_sum_net + v_sum_vat then
    return false;
  end if;
  if (p_value ->> 'reverseChargeApplied')::boolean is distinct from v_has_reverse then
    return false;
  end if;
  if (v_has_reverse and (
    p_value ->> 'documentVatType' <> 'REVERSE_CHARGE_CONSTRUCTION'
    or jsonb_typeof(p_value -> 'buyerVatNumber') <> 'string'
    or not public.is_story_10_6_buyer_vat_number(p_value ->> 'buyerVatNumber')
  )) or ((not v_has_reverse) and p_value ->> 'documentVatType' <> 'STANDARD_VAT_25') then
    return false;
  end if;
  if jsonb_typeof(p_value -> 'buyerVatNumber') = 'string'
     and not public.is_story_10_6_buyer_vat_number(p_value ->> 'buyerVatNumber') then
    return false;
  end if;

  if not ((p_value -> 'netByDeductionClassification') ?& array[
       'NONE', 'ROT_LABOR', 'GREEN_SOLAR_LABOR', 'GREEN_SOLAR_MATERIAL',
       'GREEN_STORAGE_LABOR', 'GREEN_STORAGE_MATERIAL',
       'GREEN_CHARGING_LABOR', 'GREEN_CHARGING_MATERIAL'
     ])
     or not ((p_value -> 'vatByDeductionClassification') ?& array[
       'NONE', 'ROT_LABOR', 'GREEN_SOLAR_LABOR', 'GREEN_SOLAR_MATERIAL',
       'GREEN_STORAGE_LABOR', 'GREEN_STORAGE_MATERIAL',
       'GREEN_CHARGING_LABOR', 'GREEN_CHARGING_MATERIAL'
     ]) then
    return false;
  end if;
  v_sum_net := 0;
  v_sum_vat := 0;
  foreach v_classification in array array[
    'NONE', 'ROT_LABOR', 'GREEN_SOLAR_LABOR', 'GREEN_SOLAR_MATERIAL',
    'GREEN_STORAGE_LABOR', 'GREEN_STORAGE_MATERIAL',
    'GREEN_CHARGING_LABOR', 'GREEN_CHARGING_MATERIAL'
  ]
  loop
    if not public.is_story_10_6_ore(p_value #> array['netByDeductionClassification', v_classification])
       or not public.is_story_10_6_ore(p_value #> array['vatByDeductionClassification', v_classification]) then
      return false;
    end if;
    v_sum_net := v_sum_net + (p_value #>> array['netByDeductionClassification', v_classification])::bigint;
    v_sum_vat := v_sum_vat + (p_value #>> array['vatByDeductionClassification', v_classification])::bigint;
  end loop;
  if v_sum_net <> (p_value ->> 'netOre')::bigint
     or v_sum_vat <> (p_value ->> 'vatOre')::bigint then
    return false;
  end if;

  if not ((p_value -> 'summaries') ?& array['labor', 'material', 'other']) then
    return false;
  end if;
  v_sum_net := 0;
  v_sum_vat := 0;
  v_sum_gross := 0;
  foreach v_bucket in array array['labor', 'material', 'other']
  loop
    v_value := p_value #> array['summaries', v_bucket];
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['netOre', 'vatOre', 'grossOre'])
       or not public.is_story_10_6_ore(v_value -> 'netOre')
       or not public.is_story_10_6_ore(v_value -> 'vatOre')
       or not public.is_story_10_6_ore(v_value -> 'grossOre')
       or (v_value ->> 'grossOre')::bigint
          <> (v_value ->> 'netOre')::bigint + (v_value ->> 'vatOre')::bigint then
      return false;
    end if;
    v_sum_net := v_sum_net + (v_value ->> 'netOre')::bigint;
    v_sum_vat := v_sum_vat + (v_value ->> 'vatOre')::bigint;
    v_sum_gross := v_sum_gross + (v_value ->> 'grossOre')::bigint;
  end loop;
  if v_sum_net <> (p_value ->> 'netOre')::bigint
     or v_sum_vat <> (p_value ->> 'vatOre')::bigint
     or v_sum_gross <> (p_value ->> 'grossOre')::bigint then
    return false;
  end if;

  v_value := p_value -> 'rot';
  if not (v_value ?& array[
       'policy', 'basisNetOre', 'allocatedVatOre', 'basisOre',
       'calculatedOre', 'claimOre', 'allocations'
     ])
     or jsonb_typeof(v_value -> 'policy') not in ('object', 'null')
     or not public.is_story_10_6_ore(v_value -> 'basisNetOre')
     or not public.is_story_10_6_ore(v_value -> 'allocatedVatOre')
     or not public.is_story_10_6_ore(v_value -> 'basisOre')
     or not public.is_story_10_6_ore(v_value -> 'calculatedOre')
     or not public.is_story_10_6_ore(v_value -> 'claimOre')
     or jsonb_typeof(v_value -> 'allocations') <> 'array'
     or (v_value ->> 'basisOre')::bigint
        <> (v_value ->> 'basisNetOre')::bigint + (v_value ->> 'allocatedVatOre')::bigint
     or (v_value ->> 'claimOre')::bigint % 100 <> 0
     or (v_value ->> 'claimOre')::bigint > (v_value ->> 'calculatedOre')::bigint then
    return false;
  end if;
  if p_value ->> 'deductionChoice' in ('ROT', 'ROT_AND_GREEN') then
    if not public.is_story_10_6_tax_policy_snapshot(v_value -> 'policy')
       or v_value #>> array['policy', 'resolvingFact'] <> 'ROT_PAYMENT_DATE' then
      return false;
    end if;
    v_policy_rate := (v_value #>> array['policy', 'values', 'rot', 'rateBp'])::numeric;
    v_expected_calculated := floor((v_value ->> 'basisOre')::numeric * v_policy_rate / 10000);
    v_expected_claim := floor(
      (v_value ->> 'basisOre')::numeric * v_policy_rate / (10000 * 100)
    ) * 100;
    if (v_value ->> 'basisNetOre')::numeric
         <> (p_value #>> array['netByDeductionClassification', 'ROT_LABOR'])::numeric
       or (v_value ->> 'allocatedVatOre')::numeric
         <> (p_value #>> array['vatByDeductionClassification', 'ROT_LABOR'])::numeric
       or (v_value ->> 'calculatedOre')::numeric <> v_expected_calculated
       or (v_value ->> 'claimOre')::numeric <> v_expected_claim then
      return false;
    end if;
  elsif jsonb_typeof(v_value -> 'policy') <> 'null' then
    return false;
  elsif (v_value ->> 'basisNetOre')::bigint <> 0
     or (v_value ->> 'allocatedVatOre')::bigint <> 0
     or (v_value ->> 'basisOre')::bigint <> 0
     or (v_value ->> 'calculatedOre')::bigint <> 0
     or (v_value ->> 'claimOre')::bigint <> 0
     or jsonb_array_length(v_value -> 'allocations') <> 0 then
    return false;
  end if;
  v_sum_alloc := 0;
  for v_value in select value from jsonb_array_elements((p_value -> 'rot') -> 'allocations')
  loop
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['slot', 'ore'])
       or jsonb_typeof(v_value -> 'slot') <> 'string'
       or not ((v_value ->> 'slot') ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$')
       or not public.is_story_10_6_ore(v_value -> 'ore')
       or (v_value ->> 'ore')::bigint % 100 <> 0
       or (v_value ->> 'ore')::numeric > (
         p_value #>> array['rot', 'policy', 'values', 'rot', 'maxPerPersonYearOre']
       )::numeric then
      return false;
    end if;
    if (v_value ->> 'slot') = any(v_seen_slots) then
      return false;
    end if;
    v_seen_slots := array_append(v_seen_slots, v_value ->> 'slot');
    v_sum_alloc := v_sum_alloc + (v_value ->> 'ore')::bigint;
  end loop;
  if v_sum_alloc <> (p_value #>> array['rot', 'claimOre'])::bigint then
    return false;
  end if;

  v_value := p_value -> 'green';
  if not (v_value ?& array[
       'policy', 'basisMethod', 'categories', 'calculatedOre', 'claimOre', 'allocations'
     ])
     or jsonb_typeof(v_value -> 'policy') not in ('object', 'null')
     or v_value ->> 'basisMethod' not in ('ACTUAL_ELIGIBLE_COSTS', 'FIXED_PRICE_97_PERCENT')
     or jsonb_typeof(v_value -> 'categories') <> 'object'
     or not ((v_value -> 'categories') ?& array['SOLAR', 'STORAGE', 'CHARGING'])
     or not public.is_story_10_6_ore(v_value -> 'calculatedOre')
     or not public.is_story_10_6_ore(v_value -> 'claimOre')
     or jsonb_typeof(v_value -> 'allocations') <> 'array'
     or (v_value ->> 'claimOre')::bigint % 100 <> 0
     or (v_value ->> 'claimOre')::bigint > (v_value ->> 'calculatedOre')::bigint then
    return false;
  end if;
  if p_value ->> 'deductionChoice' in ('GREEN', 'ROT_AND_GREEN') then
    if not public.is_story_10_6_tax_policy_snapshot(v_value -> 'policy')
       or v_value #>> array['policy', 'resolvingFact'] <> 'GREEN_FINAL_PAYMENT_DATE' then
      return false;
    end if;
  elsif jsonb_typeof(v_value -> 'policy') <> 'null' then
    return false;
  elsif (v_value ->> 'calculatedOre')::bigint <> 0
     or (v_value ->> 'claimOre')::bigint <> 0
     or jsonb_array_length(v_value -> 'allocations') <> 0 then
    return false;
  end if;
  v_sum_calculated := 0;
  v_sum_claim := 0;
  foreach v_category in array array['SOLAR', 'STORAGE', 'CHARGING']
  loop
    v_value := p_value #> array['green', 'categories', v_category];
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['category', 'basisOre', 'calculatedOre', 'claimOre'])
       or v_value ->> 'category' <> v_category
       or not public.is_story_10_6_ore(v_value -> 'basisOre')
       or not public.is_story_10_6_ore(v_value -> 'calculatedOre')
       or not public.is_story_10_6_ore(v_value -> 'claimOre')
       or (v_value ->> 'claimOre')::bigint % 100 <> 0
       or (v_value ->> 'claimOre')::bigint > (v_value ->> 'calculatedOre')::bigint then
      return false;
    end if;
    if p_value ->> 'deductionChoice' not in ('GREEN', 'ROT_AND_GREEN')
       and (
         (v_value ->> 'basisOre')::bigint <> 0
         or (v_value ->> 'calculatedOre')::bigint <> 0
         or (v_value ->> 'claimOre')::bigint <> 0
      ) then
      return false;
    end if;
    if p_value ->> 'deductionChoice' in ('GREEN', 'ROT_AND_GREEN') then
      v_labor_classification := 'GREEN_' || v_category || '_LABOR';
      v_material_classification := 'GREEN_' || v_category || '_MATERIAL';
      v_classified_green_gross :=
          (p_value #>> array['netByDeductionClassification', v_labor_classification])::numeric
        + (p_value #>> array['vatByDeductionClassification', v_labor_classification])::numeric
        + (p_value #>> array['netByDeductionClassification', v_material_classification])::numeric
        + (p_value #>> array['vatByDeductionClassification', v_material_classification])::numeric;
      if (p_value #>> array['green', 'basisMethod']) = 'ACTUAL_ELIGIBLE_COSTS' then
        v_expected_green_basis := v_classified_green_gross;
      else
        v_expected_green_basis := floor(
          v_classified_green_gross
          * (p_value #>> array[
              'green', 'policy', 'values', 'green', 'fixedPriceEligibleShareBp'
            ])::numeric
          / 10000
        );
      end if;
      if (v_value ->> 'basisOre')::numeric <> v_expected_green_basis then
        return false;
      end if;
      v_policy_rate := (
        p_value #>> array[
          'green', 'policy', 'values', 'green', 'rateBpByCategory', v_category
        ]
      )::numeric;
      if (p_value #>> array['green', 'basisMethod']) = 'ACTUAL_ELIGIBLE_COSTS' then
        v_expected_calculated := floor(v_expected_green_basis * v_policy_rate / 10000);
        v_expected_claim := floor(v_expected_green_basis * v_policy_rate / (10000 * 100)) * 100;
      else
        -- The application performs the fixed-price calculation as one exact
        -- rational expression. Do not reuse the already-floored displayed basis.
        v_expected_calculated := floor(
          v_classified_green_gross
          * (p_value #>> array[
              'green', 'policy', 'values', 'green', 'fixedPriceEligibleShareBp'
            ])::numeric
          * v_policy_rate
          / (10000 * 10000)
        );
        v_expected_claim := floor(
          v_classified_green_gross
          * (p_value #>> array[
              'green', 'policy', 'values', 'green', 'fixedPriceEligibleShareBp'
            ])::numeric
          * v_policy_rate
          / 10000000000::numeric
        ) * 100;
      end if;
      if (v_value ->> 'calculatedOre')::numeric <> v_expected_calculated
         or (v_value ->> 'claimOre')::numeric <> v_expected_claim then
        return false;
      end if;
    end if;
    v_sum_calculated := v_sum_calculated + (v_value ->> 'calculatedOre')::bigint;
    v_sum_claim := v_sum_claim + (v_value ->> 'claimOre')::bigint;
  end loop;
  if v_sum_calculated <> (p_value #>> array['green', 'calculatedOre'])::bigint
     or v_sum_claim <> (p_value #>> array['green', 'claimOre'])::bigint then
    return false;
  end if;
  v_sum_alloc := 0;
  v_seen_slots := array[]::text[];
  for v_value in select value from jsonb_array_elements((p_value -> 'green') -> 'allocations')
  loop
    if jsonb_typeof(v_value) <> 'object'
       or not (v_value ?& array['slot', 'ore'])
       or jsonb_typeof(v_value -> 'slot') <> 'string'
       or not ((v_value ->> 'slot') ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$')
       or not public.is_story_10_6_ore(v_value -> 'ore')
       or (v_value ->> 'ore')::bigint % 100 <> 0
       or (v_value ->> 'ore')::numeric > (
         p_value #>> array['green', 'policy', 'values', 'green', 'maxPerPersonYearOre']
       )::numeric then
      return false;
    end if;
    if (v_value ->> 'slot') = any(v_seen_slots) then
      return false;
    end if;
    v_seen_slots := array_append(v_seen_slots, v_value ->> 'slot');
    v_sum_alloc := v_sum_alloc + (v_value ->> 'ore')::bigint;
  end loop;
  if v_sum_alloc <> (p_value #>> array['green', 'claimOre'])::bigint then
    return false;
  end if;

  if (p_value ->> 'calculatedDeductionOre')::bigint
       <> (p_value #>> array['rot', 'calculatedOre'])::bigint
        + (p_value #>> array['green', 'calculatedOre'])::bigint
     or (p_value ->> 'claimDeductionOre')::bigint
       <> (p_value #>> array['rot', 'claimOre'])::bigint
        + (p_value #>> array['green', 'claimOre'])::bigint
     or (p_value ->> 'deductionOre')::bigint
       <> (p_value ->> 'claimDeductionOre')::bigint
     or (p_value ->> 'claimDeductionOre')::bigint % 100 <> 0
     or (p_value ->> 'claimDeductionOre')::bigint > (p_value ->> 'grossOre')::bigint
     or (p_value ->> 'payableOre')::bigint
       <> (p_value ->> 'grossOre')::bigint - (p_value ->> 'claimDeductionOre')::bigint then
    return false;
  end if;

  if jsonb_typeof(p_value #> array['rot', 'policy']) = 'object' then
    v_policy_id := p_value #>> array['rot', 'policy', 'id'];
    if not ((p_value -> 'taxRuleVersions') @> jsonb_build_array(v_policy_id)) then
      return false;
    end if;
    v_expected_rule_ids := array_append(v_expected_rule_ids, v_policy_id);
  end if;
  if jsonb_typeof(p_value #> array['green', 'policy']) = 'object' then
    v_policy_id := p_value #>> array['green', 'policy', 'id'];
    if not ((p_value -> 'taxRuleVersions') @> jsonb_build_array(v_policy_id)) then
      return false;
    end if;
    v_expected_rule_ids := array_append(v_expected_rule_ids, v_policy_id);
  end if;

  select coalesce(array_agg(distinct id order by id), array[]::text[])
    into v_distinct_expected_rule_ids
    from unnest(v_expected_rule_ids) as ids(id);
  if cardinality(v_seen_rule_ids) <> cardinality(v_distinct_expected_rule_ids)
     or exists (
       select 1 from unnest(v_seen_rule_ids) as ids(id)
       where not (id = any(v_distinct_expected_rule_ids))
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

-- Recompute the complete document answer from the actual frozen line payload.
-- Category VAT is rounded half-up once per (vat_type, rate_bp), then allocated
-- to classification and summary buckets by canonical largest remainder.
create or replace function public.is_story_10_6_quote_lines_reconciled(
  p_answer jsonb,
  p_lines jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_classes constant text[] := array[
    'NONE', 'ROT_LABOR', 'GREEN_SOLAR_LABOR', 'GREEN_SOLAR_MATERIAL',
    'GREEN_STORAGE_LABOR', 'GREEN_STORAGE_MATERIAL',
    'GREEN_CHARGING_LABOR', 'GREEN_CHARGING_MATERIAL'
  ];
  v_summaries constant text[] := array['labor', 'material', 'other'];
  v_line jsonb;
  v_category jsonb;
  v_class_index integer;
  v_summary_index integer;
  v_i integer;
  v_rank integer;
  v_best_index integer;
  v_matching_lines integer;
  v_category_exists boolean;
  v_category_net numeric;
  v_category_vat numeric;
  v_expected_vat numeric;
  v_remainder_ore integer;
  v_best_remainder numeric;
  v_class_net numeric[] := array_fill(0::numeric, array[8]);
  v_class_vat numeric[] := array_fill(0::numeric, array[8]);
  v_summary_net numeric[] := array_fill(0::numeric, array[3]);
  v_summary_vat numeric[] := array_fill(0::numeric, array[3]);
  v_bucket_net numeric[];
  v_bucket_floor numeric[];
  v_bucket_remainder numeric[];
  v_bonus_used boolean[];
begin
  if not public.is_story_10_6_tax_answer_v2(p_answer)
     or p_lines is null
     or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) > 500
     or p_lines is null
     or jsonb_typeof(p_lines) <> 'array' then
    return false;
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object'
       or not (v_line ?& array[
         'rowType', 'lineNetOre', 'vatRateBp', 'includedInInvoiceTotal',
         'deductionClassification', 'vatType'
       ])
       or jsonb_typeof(v_line -> 'rowType') <> 'string'
       or not public.is_story_10_6_ore(v_line -> 'lineNetOre')
       or jsonb_typeof(v_line -> 'vatRateBp') <> 'number'
       or (v_line ->> 'vatRateBp')::numeric
          <> trunc((v_line ->> 'vatRateBp')::numeric)
       or (v_line ->> 'vatRateBp')::numeric not between 0 and 10000
       or jsonb_typeof(v_line -> 'includedInInvoiceTotal') <> 'boolean'
       or v_line ->> 'deductionClassification' <> all(v_classes)
       or (
         v_line ->> 'deductionClassification' <> 'NONE'
         and (
           (v_line ->> 'rowType' = 'labor'
             and v_line ->> 'deductionClassification' not in (
               'ROT_LABOR', 'GREEN_SOLAR_LABOR',
               'GREEN_STORAGE_LABOR', 'GREEN_CHARGING_LABOR'
             ))
           or (v_line ->> 'rowType' = 'material'
             and v_line ->> 'deductionClassification' not in (
               'GREEN_SOLAR_MATERIAL', 'GREEN_STORAGE_MATERIAL',
               'GREEN_CHARGING_MATERIAL'
             ))
           or v_line ->> 'rowType' not in ('labor', 'material')
         )
       )
       or v_line ->> 'vatType' not in (
         'STANDARD_VAT_25', 'REDUCED_VAT', 'ZERO_RATED',
         'REVERSE_CHARGE_CONSTRUCTION'
       )
       or (
         v_line ->> 'vatType' = 'ZERO_RATED'
         and (v_line ->> 'vatRateBp')::numeric <> 0
       ) then
      return false;
    end if;

    if (v_line ->> 'includedInInvoiceTotal')::boolean then
      select exists(
        select 1
          from jsonb_array_elements(p_answer -> 'categories') as categories(value)
         where value ->> 'vatType' = v_line ->> 'vatType'
           and (value ->> 'rateBp')::numeric = (v_line ->> 'vatRateBp')::numeric
      ) into v_category_exists;
      if not v_category_exists then
        return false;
      end if;

      v_class_index := array_position(v_classes, v_line ->> 'deductionClassification');
      v_class_net[v_class_index] := v_class_net[v_class_index]
        + (v_line ->> 'lineNetOre')::numeric;
      v_summary_index := case v_line ->> 'rowType'
        when 'labor' then 1
        when 'material' then 2
        else 3
      end;
      v_summary_net[v_summary_index] := v_summary_net[v_summary_index]
        + (v_line ->> 'lineNetOre')::numeric;
    end if;
  end loop;

  for v_category in select value from jsonb_array_elements(p_answer -> 'categories')
  loop
    select count(*)::integer,
           coalesce(sum((value ->> 'lineNetOre')::numeric), 0)
      into v_matching_lines, v_category_net
      from jsonb_array_elements(p_lines) as lines(value)
     where (value ->> 'includedInInvoiceTotal')::boolean
       and value ->> 'vatType' = v_category ->> 'vatType'
       and (value ->> 'vatRateBp')::numeric = (v_category ->> 'rateBp')::numeric;
    if v_matching_lines = 0 then
      return false;
    end if;

    v_expected_vat := case
      when v_category ->> 'vatType' = 'REVERSE_CHARGE_CONSTRUCTION' then 0
      else floor(
        (v_category_net * (v_category ->> 'rateBp')::numeric + 5000) / 10000
      )
    end;
    v_category_vat := (v_category ->> 'vatOre')::numeric;
    if (v_category ->> 'netOre')::numeric <> v_category_net
       or v_category_vat <> v_expected_vat
       or (v_category ->> 'grossOre')::numeric <> v_category_net + v_expected_vat then
      return false;
    end if;

    v_bucket_net := array_fill(0::numeric, array[8]);
    for v_line in
      select value
        from jsonb_array_elements(p_lines) as lines(value)
       where (value ->> 'includedInInvoiceTotal')::boolean
         and value ->> 'vatType' = v_category ->> 'vatType'
         and (value ->> 'vatRateBp')::numeric = (v_category ->> 'rateBp')::numeric
    loop
      v_class_index := array_position(v_classes, v_line ->> 'deductionClassification');
      v_bucket_net[v_class_index] := v_bucket_net[v_class_index]
        + (v_line ->> 'lineNetOre')::numeric;
    end loop;
    v_bucket_floor := array_fill(0::numeric, array[8]);
    v_bucket_remainder := array_fill(0::numeric, array[8]);
    v_bonus_used := array_fill(false, array[8]);
    if v_category_vat > 0 and v_category_net > 0 then
      for v_i in 1..8 loop
        if v_bucket_net[v_i] > 0 then
          v_bucket_floor[v_i] := floor(v_category_vat * v_bucket_net[v_i] / v_category_net);
          v_bucket_remainder[v_i] := mod(v_category_vat * v_bucket_net[v_i], v_category_net);
        end if;
      end loop;
      v_remainder_ore := (
        v_category_vat
        - (select sum(entry) from unnest(v_bucket_floor) as entries(entry))
      )::integer;
      for v_rank in 1..v_remainder_ore loop
        v_best_index := null;
        v_best_remainder := -1;
        for v_i in 1..8 loop
          if v_bucket_net[v_i] > 0
             and not v_bonus_used[v_i]
             and (
               v_bucket_remainder[v_i] > v_best_remainder
               or (
                 v_bucket_remainder[v_i] = v_best_remainder
                 and (v_best_index is null or v_i < v_best_index)
               )
             ) then
            v_best_index := v_i;
            v_best_remainder := v_bucket_remainder[v_i];
          end if;
        end loop;
        if v_best_index is null then
          return false;
        end if;
        v_bucket_floor[v_best_index] := v_bucket_floor[v_best_index] + 1;
        v_bonus_used[v_best_index] := true;
      end loop;
    end if;
    for v_i in 1..8 loop
      v_class_vat[v_i] := v_class_vat[v_i] + v_bucket_floor[v_i];
    end loop;

    v_bucket_net := array_fill(0::numeric, array[3]);
    for v_line in
      select value
        from jsonb_array_elements(p_lines) as lines(value)
       where (value ->> 'includedInInvoiceTotal')::boolean
         and value ->> 'vatType' = v_category ->> 'vatType'
         and (value ->> 'vatRateBp')::numeric = (v_category ->> 'rateBp')::numeric
    loop
      v_summary_index := case v_line ->> 'rowType'
        when 'labor' then 1
        when 'material' then 2
        else 3
      end;
      v_bucket_net[v_summary_index] := v_bucket_net[v_summary_index]
        + (v_line ->> 'lineNetOre')::numeric;
    end loop;
    v_bucket_floor := array_fill(0::numeric, array[3]);
    v_bucket_remainder := array_fill(0::numeric, array[3]);
    v_bonus_used := array_fill(false, array[3]);
    if v_category_vat > 0 and v_category_net > 0 then
      for v_i in 1..3 loop
        if v_bucket_net[v_i] > 0 then
          v_bucket_floor[v_i] := floor(v_category_vat * v_bucket_net[v_i] / v_category_net);
          v_bucket_remainder[v_i] := mod(v_category_vat * v_bucket_net[v_i], v_category_net);
        end if;
      end loop;
      v_remainder_ore := (
        v_category_vat
        - (select sum(entry) from unnest(v_bucket_floor) as entries(entry))
      )::integer;
      for v_rank in 1..v_remainder_ore loop
        v_best_index := null;
        v_best_remainder := -1;
        for v_i in 1..3 loop
          if v_bucket_net[v_i] > 0
             and not v_bonus_used[v_i]
             and (
               v_bucket_remainder[v_i] > v_best_remainder
               or (
                 v_bucket_remainder[v_i] = v_best_remainder
                 and (v_best_index is null or v_i < v_best_index)
               )
             ) then
            v_best_index := v_i;
            v_best_remainder := v_bucket_remainder[v_i];
          end if;
        end loop;
        if v_best_index is null then
          return false;
        end if;
        v_bucket_floor[v_best_index] := v_bucket_floor[v_best_index] + 1;
        v_bonus_used[v_best_index] := true;
      end loop;
    end if;
    for v_i in 1..3 loop
      v_summary_vat[v_i] := v_summary_vat[v_i] + v_bucket_floor[v_i];
    end loop;
  end loop;

  for v_i in 1..8 loop
    if (p_answer #>> array['netByDeductionClassification', v_classes[v_i]])::numeric
         <> v_class_net[v_i]
       or (p_answer #>> array['vatByDeductionClassification', v_classes[v_i]])::numeric
         <> v_class_vat[v_i] then
      return false;
    end if;
  end loop;
  for v_i in 1..3 loop
    if (p_answer #>> array['summaries', v_summaries[v_i], 'netOre'])::numeric
         <> v_summary_net[v_i]
       or (p_answer #>> array['summaries', v_summaries[v_i], 'vatOre'])::numeric
         <> v_summary_vat[v_i]
       or (p_answer #>> array['summaries', v_summaries[v_i], 'grossOre'])::numeric
         <> v_summary_net[v_i] + v_summary_vat[v_i] then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

-- Bind a reconciled answer to the versioned calculation-side choices and policy
-- resolving dates. Person allocations are checked against the declared, PII-free
-- per-scheme and combined capacities; a caller cannot manufacture extra allowance.
create or replace function public.is_story_10_6_tax_answer_matches_input(
  p_answer jsonb,
  p_tax_input jsonb,
  p_quote_capture_date date
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_scheme text;
  v_category text;
  v_slot jsonb;
  v_allocation jsonb;
  v_allocations jsonb;
  v_claim numeric;
  v_capacity numeric;
  v_total_capacity numeric;
  v_remaining numeric;
  v_expected_allocation numeric;
  v_allocation_index integer;
  v_classified_gross numeric;
begin
  if p_quote_capture_date is null
     or not public.is_story_10_6_tax_answer_v2(p_answer)
     or not public.is_story_10_6_tax_input_v2(p_tax_input)
     or p_answer ->> 'documentVatType' is distinct from p_tax_input ->> 'documentVatType'
     or p_answer -> 'buyerVatNumber' is distinct from p_tax_input -> 'buyerVatNumber'
     or p_answer ->> 'deductionChoice' is distinct from p_tax_input ->> 'deductionChoice'
     or p_answer #>> array['green', 'basisMethod']
        is distinct from p_tax_input ->> 'greenBasisMethod'
     or p_answer #>> array['vatPolicy', 'resolvingDate']
        is distinct from p_quote_capture_date::text then
    return false;
  end if;

  if p_answer ->> 'deductionChoice' in ('ROT', 'ROT_AND_GREEN')
     and p_answer #>> array['rot', 'policy', 'resolvingDate']
         is distinct from p_tax_input ->> 'paymentDate' then
    return false;
  end if;
  if p_answer ->> 'deductionChoice' in ('GREEN', 'ROT_AND_GREEN')
     and p_answer #>> array['green', 'policy', 'resolvingDate']
         is distinct from p_tax_input ->> 'finalPaymentDate' then
    return false;
  end if;

  if p_answer ->> 'deductionChoice' in ('GREEN', 'ROT_AND_GREEN')
     and p_tax_input ->> 'greenBasisMethod' = 'FIXED_PRICE_97_PERCENT' then
    foreach v_category in array array['SOLAR', 'STORAGE', 'CHARGING']
    loop
      v_classified_gross :=
          (p_answer #>> array[
            'netByDeductionClassification', 'GREEN_' || v_category || '_LABOR'
          ])::numeric
        + (p_answer #>> array[
            'vatByDeductionClassification', 'GREEN_' || v_category || '_LABOR'
          ])::numeric
        + (p_answer #>> array[
            'netByDeductionClassification', 'GREEN_' || v_category || '_MATERIAL'
          ])::numeric
        + (p_answer #>> array[
            'vatByDeductionClassification', 'GREEN_' || v_category || '_MATERIAL'
          ])::numeric;
      if (p_tax_input #>> array['fixedPriceCategorySplitOre', v_category])::numeric
           <> v_classified_gross then
        return false;
      end if;
    end loop;
  end if;

  foreach v_scheme in array array['ROT', 'GREEN']
  loop
    if (v_scheme = 'ROT' and p_answer ->> 'deductionChoice' not in ('ROT', 'ROT_AND_GREEN'))
       or (v_scheme = 'GREEN' and p_answer ->> 'deductionChoice' not in ('GREEN', 'ROT_AND_GREEN')) then
      continue;
    end if;
    v_claim := case v_scheme
      when 'ROT' then (p_answer #>> array['rot', 'claimOre'])::numeric
      else (p_answer #>> array['green', 'claimOre'])::numeric
    end;
    v_total_capacity := 0;
    for v_slot in select value from jsonb_array_elements(p_tax_input -> 'personAllowanceSlots')
    loop
      if v_scheme = 'ROT' then
        v_capacity := least(
          5000000,
          coalesce(
            (v_slot ->> 'remainingRotAllowanceOre')::numeric,
            (v_slot ->> 'remainingAllowanceOre')::numeric,
            0
          ),
          coalesce(
            (v_slot ->> 'remainingCombinedRotRutAllowanceOre')::numeric,
            7500000
          )
        );
      else
        v_capacity := least(
          5000000,
          coalesce(
            (v_slot ->> 'remainingGreenAllowanceOre')::numeric,
            (v_slot ->> 'remainingAllowanceOre')::numeric,
            0
          )
        );
      end if;
      v_total_capacity := v_total_capacity + floor(v_capacity / 100) * 100;
    end loop;
    if v_claim > v_total_capacity then
      return false;
    end if;

    v_allocations := case v_scheme
      when 'ROT' then p_answer #> array['rot', 'allocations']
      else p_answer #> array['green', 'allocations']
    end;
    v_remaining := v_claim;
    v_allocation_index := 0;
    -- jsonb_array_elements preserves the explicit stable slot order authored in
    -- the calculation input. The answer must contain exactly the same greedy,
    -- zero-omitting allocation sequence as the application engine.
    for v_slot in select value from jsonb_array_elements(p_tax_input -> 'personAllowanceSlots')
    loop
      if v_scheme = 'ROT' then
        v_capacity := least(
          5000000,
          coalesce(
            (v_slot ->> 'remainingRotAllowanceOre')::numeric,
            (v_slot ->> 'remainingAllowanceOre')::numeric,
            0
          ),
          coalesce(
            (v_slot ->> 'remainingCombinedRotRutAllowanceOre')::numeric,
            7500000
          )
        );
      else
        v_capacity := least(
          5000000,
          coalesce(
            (v_slot ->> 'remainingGreenAllowanceOre')::numeric,
            (v_slot ->> 'remainingAllowanceOre')::numeric,
            0
          )
        );
      end if;
      v_expected_allocation := least(floor(v_capacity / 100) * 100, v_remaining);
      if v_expected_allocation > 0 then
        v_allocation := v_allocations -> v_allocation_index;
        if jsonb_typeof(v_allocation) <> 'object'
           or v_allocation ->> 'slot' is distinct from v_slot ->> 'slot'
           or (v_allocation ->> 'ore')::numeric <> v_expected_allocation then
          return false;
        end if;
        v_allocation_index := v_allocation_index + 1;
        v_remaining := v_remaining - v_expected_allocation;
      end if;
    end loop;
    if v_remaining <> 0
       or jsonb_array_length(v_allocations) <> v_allocation_index then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.story_10_6_tax_rule_version(p_value jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_result text;
begin
  if not public.is_story_10_6_tax_answer_v2(p_value) then
    return null;
  end if;
  select string_agg(entry #>> '{}', '+' order by entry #>> '{}')
    into v_result
    from jsonb_array_elements(p_value -> 'taxRuleVersions') as items(entry);
  return v_result;
exception when others then
  return null;
end;
$$;

revoke execute on function public.is_story_10_6_ore(jsonb) from public;
revoke execute on function public.is_story_10_6_tax_policy_snapshot(jsonb) from public;
revoke execute on function public.is_story_10_6_buyer_vat_number(text) from public;
revoke execute on function public.is_story_10_6_tax_input_v2(jsonb) from public;
revoke execute on function public.is_story_10_6_tax_answer_v2(jsonb) from public;
revoke execute on function public.is_story_10_6_quote_lines_reconciled(jsonb, jsonb)
  from public;
revoke execute on function public.is_story_10_6_tax_answer_matches_input(jsonb, jsonb, date)
  from public;
revoke execute on function public.story_10_6_tax_rule_version(jsonb) from public;
grant execute on function public.is_story_10_6_ore(jsonb)
  to authenticated, service_role;
grant execute on function public.is_story_10_6_tax_policy_snapshot(jsonb)
  to authenticated, service_role;
grant execute on function public.is_story_10_6_buyer_vat_number(text)
  to authenticated, service_role;
grant execute on function public.is_story_10_6_tax_input_v2(jsonb)
  to authenticated, service_role;
grant execute on function public.is_story_10_6_tax_answer_v2(jsonb)
  to authenticated, service_role;
grant execute on function public.is_story_10_6_quote_lines_reconciled(jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.is_story_10_6_tax_answer_matches_input(jsonb, jsonb, date)
  to authenticated, service_role;
grant execute on function public.story_10_6_tax_rule_version(jsonb)
  to authenticated, service_role;

comment on function public.is_story_10_6_tax_input_v2(jsonb) is
  'Fail-closed immutable validator used by the calculation tax-input CHECK. SQL NULL and JSON null never count as a valid V2 answer.';
comment on function public.is_story_10_6_tax_answer_v2(jsonb) is
  'Fail-closed immutable structural and arithmetic validator for a frozen Story 10.6 V2 tax answer; validates category/classification/summary reconciliation, policies, reverse-charge metadata, whole-SEK claims and allocations.';
comment on function public.is_story_10_6_quote_lines_reconciled(jsonb, jsonb) is
  'Fail-closed line reconciliation for Story 10.6: recomputes half-up category VAT and canonical largest-remainder classification/summary VAT buckets from frozen line facts.';
comment on function public.is_story_10_6_tax_answer_matches_input(jsonb, jsonb, date) is
  'Fail-closed Story 10.6 binding between a tax answer, the calculation tax-input snapshot, explicit policy resolving dates, fixed-price split and declared person capacities.';

-- --------------------------------------------------------------------------
-- Calculation inputs: visibility, economic inclusion and deduction eligibility
-- are independent facts. Legacy optional-selection state is interpreted exactly
-- by a controlled post-deploy job; all later totals read included_in_invoice_total only.
-- --------------------------------------------------------------------------
alter table public.calculation_rows
  add column included_in_invoice_total boolean,
  add column deduction_classification text,
  add column vat_type text;

-- DEPLOYMENT POSTURE: do not rewrite a live calculation_rows table while taking this
-- schema lock. New writes receive safe defaults; the repository-owned staged backfill
-- below is deliberately bounded and may be invoked repeatedly between deployments.
alter table public.calculation_rows
  alter column included_in_invoice_total set default true,
  alter column deduction_classification set default 'NONE',
  alter column vat_type set default 'STANDARD_VAT_25';

create or replace function public.backfill_story_10_6_calculation_rows(p_batch_size integer default 500)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'Story 10.6 backfill batch must be between 1 and 5000';
  end if;
  with candidates as (
    select id
    from public.calculation_rows
    where included_in_invoice_total is null
       or deduction_classification is null
       or vat_type is null
    order by id
    limit p_batch_size
    for update skip locked
  )
  update public.calculation_rows row
     set included_in_invoice_total = coalesce(row.included_in_invoice_total, not row.is_optional or row.is_selected is true),
         deduction_classification = coalesce(row.deduction_classification, 'NONE'),
         -- Legacy rows had no explicit VAT category. Preserve the unambiguous reduced
         -- rates; a legacy zero becomes ordinary zero-rated, never reverse.
         vat_type = coalesce(row.vat_type, case
           when row.vat_rate_bp = 0 then 'ZERO_RATED'
           when row.vat_rate_bp in (600, 1200) then 'REDUCED_VAT'
           else 'STANDARD_VAT_25'
         end)
   where row.id in (select id from candidates);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

alter table public.calculation_rows
  add constraint calculation_rows_included_in_invoice_total_present_check
    check (included_in_invoice_total is not null) not valid,
  add constraint calculation_rows_deduction_classification_present_check
    check (deduction_classification is not null) not valid,
  add constraint calculation_rows_vat_type_present_check
    check (vat_type is not null) not valid,
  add constraint calculation_rows_deduction_classification_check
    check (deduction_classification in (
      'NONE',
      'ROT_LABOR',
      'GREEN_SOLAR_LABOR',
      'GREEN_SOLAR_MATERIAL',
      'GREEN_STORAGE_LABOR',
      'GREEN_STORAGE_MATERIAL',
      'GREEN_CHARGING_LABOR',
      'GREEN_CHARGING_MATERIAL'
    )) not valid,
  add constraint calculation_rows_classification_matches_row_type_check
    check (
      deduction_classification = 'NONE'
      or (
        row_type = 'labor'
        and deduction_classification in (
          'ROT_LABOR', 'GREEN_SOLAR_LABOR',
          'GREEN_STORAGE_LABOR', 'GREEN_CHARGING_LABOR'
        )
      )
      or (
        row_type = 'material'
        and deduction_classification in (
          'GREEN_SOLAR_MATERIAL', 'GREEN_STORAGE_MATERIAL',
          'GREEN_CHARGING_MATERIAL'
        )
      )
    ) not valid,
  add constraint calculation_rows_vat_type_check
    check (vat_type in (
      'STANDARD_VAT_25',
      'REDUCED_VAT',
      'ZERO_RATED',
      'REVERSE_CHARGE_CONSTRUCTION'
    )) not valid,
  add constraint calculation_rows_vat_type_rate_check
    check (
      vat_type is null or vat_rate_bp is null or
      (vat_type = 'STANDARD_VAT_25' and vat_rate_bp in (0, 2500)) or
      (vat_type = 'REVERSE_CHARGE_CONSTRUCTION' and vat_rate_bp in (0, 2500)) or
      (vat_type = 'REDUCED_VAT' and vat_rate_bp in (600, 1200)) or
      (vat_type = 'ZERO_RATED' and vat_rate_bp = 0)
    ) not valid;

comment on column public.calculation_rows.included_in_invoice_total is
  'Story 10.6 sole economic-inclusion input. Independent of is_hidden; legacy values were backfilled once from optional selection.';
comment on column public.calculation_rows.deduction_classification is
  'Story 10.6 exact closed tax-reduction eligibility class. Defaults to NONE and is never inferred from row labels or customer type.';
comment on column public.calculation_rows.vat_type is
  'Story 10.6 explicit VAT category type. Reverse charge is a distinct type and is never inferred from a zero rate.';

-- --------------------------------------------------------------------------
-- Versioned draft-time document tax inputs. Null means a legacy/unconfigured
-- calculation and must not be silently interpreted as a V2 answer. Full semantic
-- validation (dates, PII-free slots, caps and reconciling fixed-price split) is the
-- command-layer authority; this CHECK is a fail-closed structural backstop.
-- --------------------------------------------------------------------------
alter table public.calculations
  add column tax_input_snapshot jsonb,
  add constraint calculations_tax_input_snapshot_check
    check (
      tax_input_snapshot is null
      or public.is_story_10_6_tax_input_v2(tax_input_snapshot)
    );

comment on column public.calculations.tax_input_snapshot is
  'Story 10.6 versioned, typed draft tax inputs: explicit VAT choice/buyer VAT, resolving dates, PII-free allowance slots, deduction choice and green basis/fixed-price split. Null is legacy.';

-- --------------------------------------------------------------------------
-- Frozen quote answer V2. Every field is nullable for historical V1 rows; no
-- historical tax answer, buyer VAT number, sent row or accepted record is changed.
-- New V2 snapshots are inserted atomically by both existing quote RPCs below.
-- --------------------------------------------------------------------------
alter table public.quote_versions
  drop constraint quote_versions_deduction_type_check,
  add constraint quote_versions_deduction_type_check
    check (
      deduction_type is null
      or deduction_type in ('rot', 'gron_teknik', 'rot_and_green')
    );

alter table public.quote_versions
  add column snapshot_schema_version integer,
  add column tax_rule_version text,
  add column tax_answer_snapshot jsonb,
  add column buyer_vat_number text,
  add column calculated_deduction_ore bigint,
  add column claim_deduction_ore bigint,
  add column payable_ore bigint,
  add constraint quote_versions_snapshot_schema_version_check
    check (snapshot_schema_version is null or snapshot_schema_version = 2),
  add constraint quote_versions_tax_answer_snapshot_check
    check (
      tax_answer_snapshot is null
      or public.is_story_10_6_tax_answer_v2(tax_answer_snapshot)
    ),
  add constraint quote_versions_calculated_deduction_non_negative
    check (calculated_deduction_ore is null or calculated_deduction_ore >= 0),
  add constraint quote_versions_claim_deduction_non_negative
    check (claim_deduction_ore is null or claim_deduction_ore >= 0),
  add constraint quote_versions_claim_deduction_whole_sek
    check (claim_deduction_ore is null or claim_deduction_ore % 100 = 0),
  add constraint quote_versions_payable_non_negative
    check (payable_ore is null or payable_ore >= 0),
  add constraint quote_versions_v2_tax_answer_complete
    check (
      (
        snapshot_schema_version is null
        and tax_rule_version is null
        and tax_answer_snapshot is null
        and buyer_vat_number is null
        and calculated_deduction_ore is null
        and claim_deduction_ore is null
        and payable_ore is null
      )
      or (
        snapshot_schema_version = 2
        and tax_rule_version is not null
        and length(tax_rule_version) between 1 and 512
        and tax_answer_snapshot is not null
        and public.is_story_10_6_tax_answer_v2(tax_answer_snapshot)
        and tax_rule_version = public.story_10_6_tax_rule_version(tax_answer_snapshot)
        and calculated_deduction_ore is not null
        and claim_deduction_ore is not null
        and payable_ore is not null
        and buyer_vat_number is not distinct from tax_answer_snapshot ->> 'buyerVatNumber'
        and calculated_deduction_ore = (tax_answer_snapshot ->> 'calculatedDeductionOre')::bigint
        and claim_deduction_ore = (tax_answer_snapshot ->> 'claimDeductionOre')::bigint
        and payable_ore = (tax_answer_snapshot ->> 'payableOre')::bigint
        and base_total_ore + option_total_ore
          = (tax_answer_snapshot ->> 'netOre')::bigint
        and vat_total_ore = (tax_answer_snapshot ->> 'vatOre')::bigint
        and deduction_total_ore = (tax_answer_snapshot ->> 'deductionOre')::bigint
        and deduction_type is not distinct from (
          case (tax_answer_snapshot ->> 'deductionChoice')
            when 'NONE' then null
            when 'ROT' then 'rot'
            when 'GREEN' then 'gron_teknik'
            when 'ROT_AND_GREEN' then 'rot_and_green'
          end
        )
        and accepted_price_ore = payable_ore
      )
    );

alter table public.quote_version_lines
  add column included_in_invoice_total boolean,
  add column deduction_classification text,
  add column vat_type text,
  add constraint quote_version_lines_deduction_classification_check
    check (deduction_classification is null or deduction_classification in (
      'NONE',
      'ROT_LABOR',
      'GREEN_SOLAR_LABOR',
      'GREEN_SOLAR_MATERIAL',
      'GREEN_STORAGE_LABOR',
      'GREEN_STORAGE_MATERIAL',
      'GREEN_CHARGING_LABOR',
      'GREEN_CHARGING_MATERIAL'
    )),
  add constraint quote_version_lines_classification_matches_row_type_check
    check (
      deduction_classification is null
      or deduction_classification = 'NONE'
      or (
        row_type = 'labor'
        and deduction_classification in (
          'ROT_LABOR', 'GREEN_SOLAR_LABOR',
          'GREEN_STORAGE_LABOR', 'GREEN_CHARGING_LABOR'
        )
      )
      or (
        row_type = 'material'
        and deduction_classification in (
          'GREEN_SOLAR_MATERIAL', 'GREEN_STORAGE_MATERIAL',
          'GREEN_CHARGING_MATERIAL'
        )
      )
    ),
  add constraint quote_version_lines_vat_type_check
    check (vat_type is null or vat_type in (
      'STANDARD_VAT_25',
      'REDUCED_VAT',
      'ZERO_RATED',
      'REVERSE_CHARGE_CONSTRUCTION'
    ));

comment on column public.quote_versions.snapshot_schema_version is
  'Story 10.6 frozen quote schema. Null is historical V1; 2 is the reconciled tax-answer shape.';
comment on column public.quote_versions.tax_answer_snapshot is
  'Frozen V2 category VAT, policy window/resolving date, basis method, person allocation and reverse-charge metadata. Never recomputed after creation.';
comment on column public.quote_versions.payable_ore is
  'Frozen V2 customer payable. accepted_price_ore must equal this value for V2.';
comment on column public.quote_version_lines.included_in_invoice_total is
  'Frozen economic inclusion independent of visibility. Null only on historical V1 lines.';

-- Shared fail-closed RPC boundary. Both fresh-version functions call this before
-- inserting a parent or child row. It independently recomputes the monetary answer
-- from the actual line payload and binds it to the stored calculation tax input.
create or replace function public.assert_story_10_6_fresh_quote_v2(
  p_snapshot jsonb,
  p_lines jsonb,
  p_tax_input jsonb,
  p_quote_capture_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_line jsonb;
begin
  if p_snapshot is null
     or jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(p_snapshot -> 'snapshotSchemaVersion') <> 'number'
     or (p_snapshot ->> 'snapshotSchemaVersion')::numeric <> 2
     or jsonb_typeof(p_snapshot -> 'taxRuleVersion') <> 'string'
     or length(p_snapshot ->> 'taxRuleVersion') not between 1 and 512
     or not public.is_story_10_6_tax_answer_v2(p_snapshot -> 'taxAnswerSnapshot')
     or p_snapshot ->> 'taxRuleVersion'
        is distinct from public.story_10_6_tax_rule_version(p_snapshot -> 'taxAnswerSnapshot')
     or jsonb_typeof(p_snapshot -> 'buyerVatNumber') not in ('string', 'null')
     or jsonb_typeof(p_snapshot -> 'deductionType') not in ('string', 'null')
     or not public.is_story_10_6_ore(p_snapshot -> 'calculatedDeductionOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'claimDeductionOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'payableOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'acceptedPriceOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'baseTotalOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'optionTotalOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'vatTotalOre')
     or not public.is_story_10_6_ore(p_snapshot -> 'deductionTotalOre')
     or p_snapshot ->> 'buyerVatNumber'
        is distinct from p_snapshot #>> array['taxAnswerSnapshot', 'buyerVatNumber']
     or (p_snapshot ->> 'calculatedDeductionOre')::bigint
        <> (p_snapshot #>> array['taxAnswerSnapshot', 'calculatedDeductionOre'])::bigint
     or (p_snapshot ->> 'claimDeductionOre')::bigint
        <> (p_snapshot #>> array['taxAnswerSnapshot', 'claimDeductionOre'])::bigint
     or (p_snapshot ->> 'payableOre')::bigint
        <> (p_snapshot #>> array['taxAnswerSnapshot', 'payableOre'])::bigint
     or (p_snapshot ->> 'acceptedPriceOre')::bigint
        <> (p_snapshot ->> 'payableOre')::bigint
     or (p_snapshot ->> 'baseTotalOre')::bigint
        + (p_snapshot ->> 'optionTotalOre')::bigint
        <> (p_snapshot #>> array['taxAnswerSnapshot', 'netOre'])::bigint
     or (p_snapshot ->> 'vatTotalOre')::bigint
        <> (p_snapshot #>> array['taxAnswerSnapshot', 'vatOre'])::bigint
     or (p_snapshot ->> 'deductionTotalOre')::bigint
        <> (p_snapshot #>> array['taxAnswerSnapshot', 'deductionOre'])::bigint
     or (p_snapshot ->> 'deductionType') is distinct from (
          case (p_snapshot #>> array['taxAnswerSnapshot', 'deductionChoice'])
            when 'NONE' then null
            when 'ROT' then 'rot'
            when 'GREEN' then 'gron_teknik'
            when 'ROT_AND_GREEN' then 'rot_and_green'
          end
        )
     or (p_snapshot ->> 'claimDeductionOre')::bigint % 100 <> 0 then
    raise exception
      'fresh quote versions require one complete reconciled Story 10.6 V2 tax snapshot'
      using errcode = '23514';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception
      'fresh V2 quote lines must be a JSON array with complete tax facts'
      using errcode = '23514';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object'
       or not (v_line ?& array[
         'includedInInvoiceTotal', 'deductionClassification', 'vatType'
       ])
       or jsonb_typeof(v_line -> 'includedInInvoiceTotal') <> 'boolean'
       or v_line ->> 'deductionClassification' not in (
         'NONE', 'ROT_LABOR', 'GREEN_SOLAR_LABOR', 'GREEN_SOLAR_MATERIAL',
         'GREEN_STORAGE_LABOR', 'GREEN_STORAGE_MATERIAL',
         'GREEN_CHARGING_LABOR', 'GREEN_CHARGING_MATERIAL'
       )
       or v_line ->> 'vatType' not in (
         'STANDARD_VAT_25', 'REDUCED_VAT', 'ZERO_RATED',
         'REVERSE_CHARGE_CONSTRUCTION'
       ) then
      raise exception
        'fresh V2 quote lines require non-null inclusion, classification and VAT type'
      using errcode = '23514';
    end if;
  end loop;

  if not public.is_story_10_6_quote_lines_reconciled(
       p_snapshot -> 'taxAnswerSnapshot', p_lines
     )
     or not public.is_story_10_6_tax_answer_matches_input(
       p_snapshot -> 'taxAnswerSnapshot', p_tax_input, p_quote_capture_date
     ) then
    raise exception
      'fresh V2 quote tax totals must reconcile to line facts and calculation tax input'
      using errcode = '23514';
  end if;
exception
  when others then
    raise exception
      'fresh quote versions require one complete reconciled Story 10.6 V2 payload'
      using errcode = '23514';
end;
$$;

revoke execute on function public.assert_story_10_6_fresh_quote_v2(
  jsonb, jsonb, jsonb, date
)
  from public;
grant execute on function public.assert_story_10_6_fresh_quote_v2(
  jsonb, jsonb, jsonb, date
)
  to authenticated, service_role;

comment on function public.assert_story_10_6_fresh_quote_v2(
  jsonb, jsonb, jsonb, date
) is
  'Shared RPC assertion for Story 10.6. Rejects V1/partial payloads and independently recomputes category VAT, largest-remainder buckets, deductions, policy dates, capacities and payable from frozen line facts plus the calculation tax input.';

-- Latest lost-aware sent lock, redefined fail-closed. Only derived PDF state,
-- sanctioned lifecycle status, archive timestamp and updated_at remain exempt.
-- Every current and future snapshot column (including all Story 10.6 tax fields)
-- is protected automatically by the JSONB row comparison.
create or replace function public.enforce_quote_version_sent_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stored_lines jsonb;
  v_tax_input jsonb;
  v_calculation_found boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft'
       or new.snapshot_schema_version is distinct from 2
       or new.tax_rule_version is null
       or not public.is_story_10_6_tax_answer_v2(new.tax_answer_snapshot)
       or new.tax_rule_version
          is distinct from public.story_10_6_tax_rule_version(new.tax_answer_snapshot)
       or new.accepted_price_ore is distinct from new.payable_ore then
      raise exception
        'new quote versions must start as complete Story 10.6 V2 drafts'
        using errcode = 'QV409';
    end if;
    select c.tax_input_snapshot
      into v_tax_input
      from public.calculations c
     where c.id = new.calculation_id
       and c.tenant_id = new.tenant_id
     for share;
    v_calculation_found := found;
    if not v_calculation_found
       or not public.is_story_10_6_tax_answer_matches_input(
         new.tax_answer_snapshot,
         v_tax_input,
         (new.captured_at at time zone 'UTC')::date
       ) then
      raise exception
        'new quote version tax answer must match its calculation tax input'
        using errcode = 'QV409';
    end if;
    return new;
  end if;

  if old.status = 'draft' then
    if new.status is not distinct from old.status then
      if (
        to_jsonb(new) - array[
          'intro_text', 'customer_notes', 'valid_until', 'display_mode',
          'pdf_status', 'pdf_file_id', 'pdf_generated_at', 'updated_at'
        ]
      ) is distinct from (
        to_jsonb(old) - array[
          'intro_text', 'customer_notes', 'valid_until', 'display_mode',
          'pdf_status', 'pdf_file_id', 'pdf_generated_at', 'updated_at'
        ]
      ) then
        raise exception
          'quote_versions draft updates are limited to presentation and derived PDF state'
          using errcode = 'QV409';
      end if;
      return new;
    end if;
    if new.status <> 'sent' then
      raise exception
        'quote_versions draft may only advance to sent: illegal transition % -> % (architecture §9, §11)',
        old.status, new.status
        using errcode = 'QV409';
    end if;

    -- A draft stays freely editable, but the atomic freeze transition itself may
    -- change status (plus trigger-owned updated_at) and NOTHING else. This closes
    -- the old draft→sent co-mutation bypass.
    if (to_jsonb(new) - array['status', 'updated_at']) is distinct from
       (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception
        'quote_versions draft-to-sent must not co-mutate frozen snapshot fields'
        using errcode = 'QV409';
    end if;

    -- Historical V1 rows remain byte-preserved and readable, but no V1/partial-V2
    -- draft may become a new customer commitment after this migration.
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'rowType', qvl.row_type,
                 'lineNetOre', qvl.line_net_ore,
                 'vatRateBp', qvl.vat_rate_bp,
                 'includedInInvoiceTotal', qvl.included_in_invoice_total,
                 'deductionClassification', qvl.deduction_classification,
                 'vatType', qvl.vat_type
               )
               order by qvl.sort_order, qvl.id
             ),
             '[]'::jsonb
           )
      into v_stored_lines
      from public.quote_version_lines qvl
     where qvl.quote_version_id = new.id;

    select c.tax_input_snapshot
      into v_tax_input
      from public.calculations c
     where c.id = new.calculation_id
       and c.tenant_id = new.tenant_id
     for share;
    v_calculation_found := found;

    if new.snapshot_schema_version is distinct from 2
       or new.tax_rule_version is null
       or not public.is_story_10_6_tax_answer_v2(new.tax_answer_snapshot)
       or not public.is_story_10_6_quote_lines_reconciled(
         new.tax_answer_snapshot, v_stored_lines
       )
       or not v_calculation_found
       or not public.is_story_10_6_tax_answer_matches_input(
         new.tax_answer_snapshot,
         v_tax_input,
         (new.captured_at at time zone 'UTC')::date
       )
       or new.calculated_deduction_ore is null
       or new.claim_deduction_ore is null
       or new.payable_ore is null
       or new.accepted_price_ore <> new.payable_ore
       or new.claim_deduction_ore % 100 <> 0
       or exists (
         select 1
           from public.quote_version_lines qvl
          where qvl.quote_version_id = new.id
            and (
              qvl.included_in_invoice_total is null
              or qvl.deduction_classification is null
              or qvl.vat_type is null
            )
       ) then
      raise exception
        'only a complete reconciled Story 10.6 V2 quote version may be sent'
        using errcode = 'QV409';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'sent'
       or new.status not in ('accepted', 'rejected', 'expired', 'superseded', 'lost') then
      raise exception
        'quote_versions status is irreversible once sent: illegal transition % -> % on a non-draft version (architecture §9, §11)',
        old.status, new.status
        using errcode = 'QV409';
    end if;
  end if;

  if (
    to_jsonb(new) - array[
      'pdf_status', 'pdf_file_id', 'pdf_generated_at',
      'status', 'archived_at', 'updated_at'
    ]
  ) is distinct from (
    to_jsonb(old) - array[
      'pdf_status', 'pdf_file_id', 'pdf_generated_at',
      'status', 'archived_at', 'updated_at'
    ]
  ) then
    raise exception
      'quote_versions is immutable once sent: customer-visible / commitment columns cannot be changed on a non-draft version (architecture §9, §11)'
      using errcode = 'QV409';
  end if;

  return new;
end;
$$;

comment on function public.enforce_quote_version_sent_lock() is
  'Story 10.6 fail-closed parent lock. INSERT requires a complete draft V2 bound to its calculation input; draft edits are limited to existing presentation/PDF commands; draft-to-sent changes status only and revalidates input plus the complete answer from persisted lines. Historical V1 remains readable but cannot be newly inserted or sent. Post-send snapshot fields stay immutable.';

drop trigger if exists quote_versions_sent_lock on public.quote_versions;
create trigger quote_versions_sent_lock
  before insert or update on public.quote_versions
  for each row execute function public.enforce_quote_version_sent_lock();

-- Redefine the shared line/attachment guard. UPDATE locks and inspects BOTH OLD and
-- NEW parents in deterministic UUID order, so a child cannot escape a sent version
-- by reparenting. FOR UPDATE serializes with draft→sent and closes the concurrent
-- child-write race in both directions.
create or replace function public.enforce_quote_version_child_sent_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_parent_id uuid;
  v_new_parent_id uuid;
  v_parent record;
  v_expected_count integer;
  v_seen_count integer := 0;
  v_old_parent_schema integer;
  v_new_parent_schema integer;
begin
  if tg_op <> 'INSERT' then
    v_old_parent_id := old.quote_version_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_parent_id := new.quote_version_id;
  end if;

  v_expected_count := case
    when v_old_parent_id is null or v_new_parent_id is null then 1
    when v_old_parent_id = v_new_parent_id then 1
    else 2
  end;

  for v_parent in
    select qv.id, qv.status, qv.snapshot_schema_version
      from public.quote_versions qv
     where qv.id in (v_old_parent_id, v_new_parent_id)
     order by qv.id
     for update
  loop
    v_seen_count := v_seen_count + 1;
    if v_parent.id = v_new_parent_id then
      v_new_parent_schema := v_parent.snapshot_schema_version;
    end if;
    if v_parent.id = v_old_parent_id then
      v_old_parent_schema := v_parent.snapshot_schema_version;
    end if;
    if v_parent.status <> 'draft' then
      raise exception
        'quote_version child snapshot is immutable once either parent version is sent (architecture §11)'
        using errcode = 'QV409';
    end if;
  end loop;

  -- During an FK ON DELETE CASCADE the parent row is already invisible to this
  -- child BEFORE DELETE trigger. Allow that referential cleanup only; a direct
  -- child delete still sees/locks its parent and is rejected when frozen.
  if tg_op = 'DELETE' and v_seen_count = 0 then
    return old;
  end if;

  if v_seen_count <> v_expected_count then
    raise exception
      'quote_version child parent is missing or not visible'
      using errcode = 'QV409';
  end if;

  -- A V2 child is born frozen inside an atomic creation RPC. There is no normal
  -- application path that mutates line or attachment snapshots in place; economic
  -- changes create a new quote version. Keep historical V1 draft behavior intact.
  if tg_op in ('UPDATE', 'DELETE')
     and (
       v_old_parent_schema = 2
       or coalesce(v_new_parent_schema = 2, false)
     ) then
    raise exception
      'V2 quote-version child snapshots are immutable after creation'
      using errcode = 'QV409';
  end if;

  if tg_op <> 'DELETE'
     and tg_table_name = 'quote_version_lines'
     and v_new_parent_schema = 2
     and (
       jsonb_typeof(to_jsonb(new) -> 'included_in_invoice_total') <> 'boolean'
       or jsonb_typeof(to_jsonb(new) -> 'deduction_classification') <> 'string'
       or jsonb_typeof(to_jsonb(new) -> 'vat_type') <> 'string'
     ) then
    raise exception
      'V2 quote lines require frozen inclusion, deduction classification and VAT type'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.enforce_quote_version_child_sent_lock() is
  'Story 10.6 fail-closed child lock. It serializes OLD+NEW parents in UUID order, rejects non-draft parents, makes V2 line/attachment snapshots immutable immediately after creation, and requires complete V2 line tax facts on insert.';

-- Acceptance may intentionally record an adjusted accepted price, but its
-- source_sent_total_ore must always equal the immutable customer payable captured
-- on V2 (or accepted_price_ore for a historical V1). This trigger hardens every
-- insert path, including the existing atomic acceptance RPC, without rewriting it.
create or replace function public.enforce_quote_acceptance_frozen_source_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source_total bigint;
begin
  select case
           when qv.snapshot_schema_version = 2 then qv.payable_ore
           else qv.accepted_price_ore
         end
    into v_source_total
    from public.quote_versions qv
   where qv.id = new.quote_version_id
     and qv.tenant_id = new.tenant_id
   for share;

  if not found or v_source_total is null
     or new.source_sent_total_ore is distinct from v_source_total then
    raise exception
      'quote acceptance source total must equal the frozen quote payable'
      using errcode = 'QV409';
  end if;
  return new;
end;
$$;

drop trigger if exists quote_acceptances_frozen_source_total
  on public.quote_acceptances;
create trigger quote_acceptances_frozen_source_total
  before insert on public.quote_acceptances
  for each row execute function public.enforce_quote_acceptance_frozen_source_total();

comment on function public.enforce_quote_acceptance_frozen_source_total() is
  'Story 10.6 acceptance backstop: source_sent_total_ore equals V2 payable_ore, with historical V1 falling back to its frozen accepted_price_ore. Adjusted accepted_price_ore remains supported.';

-- Both quote-creation RPC implementations retain their existing signatures. They
-- consume the same snapshot/line payload and independently verify its tax arithmetic
-- against the versioned calculation-side input before any parent or child insert.

create or replace function public.create_quote_version_from_calculation(
  p_tenant_id uuid,
  p_calculation_id uuid,
  p_captured_at timestamptz,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_snapshot jsonb,
  p_lines jsonb,
  p_attachments jsonb
)
returns table (quote_id uuid, quote_version_id uuid, quote_number bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_version_id uuid;
  v_quote_number bigint;
  v_line jsonb;
  v_att jsonb;
  v_att_file_id uuid;
  v_link_exists boolean;
  v_tax_input jsonb;
begin
  select c.tax_input_snapshot
    into v_tax_input
    from public.calculations c
   where c.id = p_calculation_id
     and c.tenant_id = p_tenant_id
   for share;
  if not found then
    raise exception 'create_quote_version_from_calculation: calculation not found for tenant'
      using errcode = 'QV409';
  end if;
  perform public.assert_story_10_6_fresh_quote_v2(
    p_snapshot,
    p_lines,
    v_tax_input,
    (p_captured_at at time zone 'UTC')::date
  );

  insert into public.tenant_counters (tenant_id, counter_name, current_value)
  values (p_tenant_id, 'quote_number', 1)
  on conflict (tenant_id, counter_name)
    do update set current_value = public.tenant_counters.current_value + 1
  returning current_value into v_quote_number;

  insert into public.quotes (tenant_id, customer_id, facility_id, contact_id)
  values (p_tenant_id, p_customer_id, p_facility_id, p_contact_id)
  returning id into v_quote_id;

  insert into public.quote_versions (
    tenant_id, quote_id, version_number, quote_number, status,
    calculation_id, captured_at,
    company_name, company_org_nr, company_address_line1, company_address_line2,
    company_postal_code, company_city, company_email, company_phone, company_logo_url,
    customer_display_name, customer_type, facility_name, contact_name,
    quote_number_display, valid_until,
    intro_text, customer_notes, terms_text, terms_approved_at, terms_approved_by,
    base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore, accepted_price_ore,
    snapshot_schema_version, tax_rule_version, tax_answer_snapshot, buyer_vat_number,
    calculated_deduction_ore, claim_deduction_ore, payable_ore,
    vat_rate_bp, vat_display, deduction_type, deduction_rate_bp, deduction_cap_ore,
    deduction_persons, requires_sign_off, display_mode, warnings_snapshot
  )
  values (
    p_tenant_id,
    v_quote_id,
    1,
    v_quote_number,
    'draft',
    p_calculation_id,
    p_captured_at,
    p_snapshot ->> 'companyName',
    p_snapshot ->> 'companyOrgNr',
    p_snapshot ->> 'companyAddressLine1',
    p_snapshot ->> 'companyAddressLine2',
    p_snapshot ->> 'companyPostalCode',
    p_snapshot ->> 'companyCity',
    p_snapshot ->> 'companyEmail',
    p_snapshot ->> 'companyPhone',
    p_snapshot ->> 'companyLogoUrl',
    p_snapshot ->> 'customerDisplayName',
    p_snapshot ->> 'customerType',
    p_snapshot ->> 'facilityName',
    p_snapshot ->> 'contactName',
    p_snapshot ->> 'quoteNumberDisplay',
    (p_snapshot ->> 'validUntil')::timestamptz,
    p_snapshot ->> 'introText',
    p_snapshot ->> 'customerNotes',
    p_snapshot ->> 'termsText',
    (p_snapshot ->> 'termsApprovedAt')::timestamptz,
    (p_snapshot ->> 'termsApprovedBy')::uuid,
    coalesce((p_snapshot ->> 'baseTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'optionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'vatTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'deductionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'acceptedPriceOre')::bigint, 0),
    (p_snapshot ->> 'snapshotSchemaVersion')::integer,
    p_snapshot ->> 'taxRuleVersion',
    p_snapshot -> 'taxAnswerSnapshot',
    p_snapshot ->> 'buyerVatNumber',
    (p_snapshot ->> 'calculatedDeductionOre')::bigint,
    (p_snapshot ->> 'claimDeductionOre')::bigint,
    (p_snapshot ->> 'payableOre')::bigint,
    (p_snapshot ->> 'vatRateBp')::integer,
    p_snapshot ->> 'vatDisplay',
    p_snapshot ->> 'deductionType',
    (p_snapshot ->> 'deductionRateBp')::integer,
    (p_snapshot ->> 'deductionCapOre')::bigint,
    (p_snapshot ->> 'deductionPersons')::integer,
    coalesce((p_snapshot ->> 'requiresSignOff')::boolean, true),
    p_snapshot ->> 'displayMode',
    coalesce(p_snapshot -> 'warnings', '[]'::jsonb)
  )
  returning id into v_version_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.quote_version_lines (
      tenant_id, quote_version_id, row_type, sort_order,
      label, description, quote_note, quantity, unit, unit_sell_ore, line_net_ore,
      vat_rate_bp, included_in_invoice_total, deduction_classification, vat_type,
      is_hidden, is_optional, is_selected
    )
    values (
      p_tenant_id,
      v_version_id,
      coalesce(v_line ->> 'rowType', 'line'),
      coalesce((v_line ->> 'sortOrder')::integer, 0),
      v_line ->> 'label',
      v_line ->> 'description',
      v_line ->> 'quoteNote',
      (v_line ->> 'quantity')::numeric,
      v_line ->> 'unit',
      (v_line ->> 'unitSellOre')::bigint,
      (v_line ->> 'lineNetOre')::bigint,
      (v_line ->> 'vatRateBp')::integer,
      (v_line ->> 'includedInInvoiceTotal')::boolean,
      v_line ->> 'deductionClassification',
      v_line ->> 'vatType',
      coalesce((v_line ->> 'isHidden')::boolean, false),
      coalesce((v_line ->> 'isOptional')::boolean, false),
      (v_line ->> 'isSelected')::boolean
    );
  end loop;

  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  loop
    v_att_file_id := (v_att ->> 'fileId')::uuid;
    insert into public.quote_version_attachments (
      tenant_id, quote_version_id, file_id, display_name, sort_order
    )
    values (
      p_tenant_id,
      v_version_id,
      v_att_file_id,
      v_att ->> 'displayName',
      coalesce((v_att ->> 'sortOrder')::integer, 0)
    );

    select exists(
      select 1 from public.file_links fl
       where fl.tenant_id = p_tenant_id
         and fl.file_id = v_att_file_id
         and fl.owner_type = 'quote_version'
         and fl.owner_id = v_version_id
         and fl.purpose = 'quote_attachment_snapshot'
    ) into v_link_exists;
    if not v_link_exists then
      insert into public.file_links (
        tenant_id, file_id, owner_type, owner_id, purpose
      )
      values (
        p_tenant_id, v_att_file_id, 'quote_version', v_version_id,
        'quote_attachment_snapshot'
      );
    end if;
  end loop;

  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, v_quote_id, v_version_id, 'created', p_captured_at
  );

  return query select v_quote_id, v_version_id, v_quote_number;
end;
$$;

comment on function public.create_quote_version_from_calculation(
  uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) is
  'Story 10.6 atomic quote-version creation RPC. It independently reconciles the prebuilt tax answer against actual line facts and the stored calculation tax input before persisting the frozen V2 parent and child snapshot.';

revoke execute on function public.create_quote_version_from_calculation(
  uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function public.create_quote_version_from_calculation(
  uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) to authenticated, service_role;

create or replace function public.create_new_quote_version(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_calculation_id uuid,
  p_captured_at timestamptz,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_snapshot jsonb,
  p_lines jsonb,
  p_attachments jsonb,
  p_supersede_prior boolean
)
returns table (quote_version_id uuid, version_number bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_version_number bigint;
  v_quote_number bigint;
  v_prior_version_id uuid;
  v_prior_status text;
  v_line jsonb;
  v_att jsonb;
  v_att_file_id uuid;
  v_link_exists boolean;
  v_tax_input jsonb;
begin
  perform 1
    from public.quotes q
   where q.id = p_quote_id
     and q.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'create_new_quote_version: parent quote not found for tenant'
      using errcode = 'QV409';
  end if;

  select c.tax_input_snapshot
    into v_tax_input
    from public.calculations c
   where c.id = p_calculation_id
     and c.tenant_id = p_tenant_id
   for share;
  if not found then
    raise exception 'create_new_quote_version: calculation not found for tenant'
      using errcode = 'QV409';
  end if;
  perform public.assert_story_10_6_fresh_quote_v2(
    p_snapshot,
    p_lines,
    v_tax_input,
    (p_captured_at at time zone 'UTC')::date
  );

  select coalesce(max(qv.version_number), 0) + 1,
         max(qv.quote_number)
    into v_version_number, v_quote_number
    from public.quote_versions qv
   where qv.quote_id = p_quote_id
     and qv.tenant_id = p_tenant_id;

  if v_quote_number is null then
    raise exception 'create_new_quote_version: parent quote has no existing version to derive quote_number from'
      using errcode = 'QV409';
  end if;

  insert into public.quote_versions (
    tenant_id, quote_id, version_number, quote_number, status,
    calculation_id, captured_at,
    company_name, company_org_nr, company_address_line1, company_address_line2,
    company_postal_code, company_city, company_email, company_phone, company_logo_url,
    customer_display_name, customer_type, facility_name, contact_name,
    quote_number_display, valid_until,
    intro_text, customer_notes, terms_text, terms_approved_at, terms_approved_by,
    base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore, accepted_price_ore,
    snapshot_schema_version, tax_rule_version, tax_answer_snapshot, buyer_vat_number,
    calculated_deduction_ore, claim_deduction_ore, payable_ore,
    vat_rate_bp, vat_display, deduction_type, deduction_rate_bp, deduction_cap_ore,
    deduction_persons, requires_sign_off, display_mode, warnings_snapshot
  )
  values (
    p_tenant_id,
    p_quote_id,
    v_version_number,
    v_quote_number,
    'draft',
    p_calculation_id,
    p_captured_at,
    p_snapshot ->> 'companyName',
    p_snapshot ->> 'companyOrgNr',
    p_snapshot ->> 'companyAddressLine1',
    p_snapshot ->> 'companyAddressLine2',
    p_snapshot ->> 'companyPostalCode',
    p_snapshot ->> 'companyCity',
    p_snapshot ->> 'companyEmail',
    p_snapshot ->> 'companyPhone',
    p_snapshot ->> 'companyLogoUrl',
    p_snapshot ->> 'customerDisplayName',
    p_snapshot ->> 'customerType',
    p_snapshot ->> 'facilityName',
    p_snapshot ->> 'contactName',
    p_snapshot ->> 'quoteNumberDisplay',
    (p_snapshot ->> 'validUntil')::timestamptz,
    p_snapshot ->> 'introText',
    p_snapshot ->> 'customerNotes',
    p_snapshot ->> 'termsText',
    (p_snapshot ->> 'termsApprovedAt')::timestamptz,
    (p_snapshot ->> 'termsApprovedBy')::uuid,
    coalesce((p_snapshot ->> 'baseTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'optionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'vatTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'deductionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'acceptedPriceOre')::bigint, 0),
    (p_snapshot ->> 'snapshotSchemaVersion')::integer,
    p_snapshot ->> 'taxRuleVersion',
    p_snapshot -> 'taxAnswerSnapshot',
    p_snapshot ->> 'buyerVatNumber',
    (p_snapshot ->> 'calculatedDeductionOre')::bigint,
    (p_snapshot ->> 'claimDeductionOre')::bigint,
    (p_snapshot ->> 'payableOre')::bigint,
    (p_snapshot ->> 'vatRateBp')::integer,
    p_snapshot ->> 'vatDisplay',
    p_snapshot ->> 'deductionType',
    (p_snapshot ->> 'deductionRateBp')::integer,
    (p_snapshot ->> 'deductionCapOre')::bigint,
    (p_snapshot ->> 'deductionPersons')::integer,
    coalesce((p_snapshot ->> 'requiresSignOff')::boolean, true),
    p_snapshot ->> 'displayMode',
    coalesce(p_snapshot -> 'warnings', '[]'::jsonb)
  )
  returning id into v_version_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.quote_version_lines (
      tenant_id, quote_version_id, row_type, sort_order,
      label, description, quote_note, quantity, unit, unit_sell_ore, line_net_ore,
      vat_rate_bp, included_in_invoice_total, deduction_classification, vat_type,
      is_hidden, is_optional, is_selected
    )
    values (
      p_tenant_id,
      v_version_id,
      coalesce(v_line ->> 'rowType', 'line'),
      coalesce((v_line ->> 'sortOrder')::integer, 0),
      v_line ->> 'label',
      v_line ->> 'description',
      v_line ->> 'quoteNote',
      (v_line ->> 'quantity')::numeric,
      v_line ->> 'unit',
      (v_line ->> 'unitSellOre')::bigint,
      (v_line ->> 'lineNetOre')::bigint,
      (v_line ->> 'vatRateBp')::integer,
      (v_line ->> 'includedInInvoiceTotal')::boolean,
      v_line ->> 'deductionClassification',
      v_line ->> 'vatType',
      coalesce((v_line ->> 'isHidden')::boolean, false),
      coalesce((v_line ->> 'isOptional')::boolean, false),
      (v_line ->> 'isSelected')::boolean
    );
  end loop;

  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  loop
    v_att_file_id := (v_att ->> 'fileId')::uuid;
    insert into public.quote_version_attachments (
      tenant_id, quote_version_id, file_id, display_name, sort_order
    )
    values (
      p_tenant_id,
      v_version_id,
      v_att_file_id,
      v_att ->> 'displayName',
      coalesce((v_att ->> 'sortOrder')::integer, 0)
    );

    select exists(
      select 1 from public.file_links fl
       where fl.tenant_id = p_tenant_id
         and fl.file_id = v_att_file_id
         and fl.owner_type = 'quote_version'
         and fl.owner_id = v_version_id
         and fl.purpose = 'quote_attachment_snapshot'
    ) into v_link_exists;
    if not v_link_exists then
      insert into public.file_links (
        tenant_id, file_id, owner_type, owner_id, purpose
      )
      values (
        p_tenant_id, v_att_file_id, 'quote_version', v_version_id,
        'quote_attachment_snapshot'
      );
    end if;
  end loop;

  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, p_quote_id, v_version_id, 'created', p_captured_at
  );

  if p_supersede_prior then
    select qv.id, qv.status
      into v_prior_version_id, v_prior_status
      from public.quote_versions qv
     where qv.quote_id = p_quote_id
       and qv.tenant_id = p_tenant_id
       and qv.version_number < v_version_number
     order by qv.version_number desc
     limit 1;

    if v_prior_version_id is not null and v_prior_status = 'sent' then
      update public.quote_versions
         set status = 'superseded'
       where id = v_prior_version_id
         and tenant_id = p_tenant_id;

      insert into public.quote_events (
        tenant_id, quote_id, quote_version_id, event_type, occurred_at
      )
      values (
        p_tenant_id, p_quote_id, v_prior_version_id, 'superseded', p_captured_at
      );
    end if;
  end if;

  return query select v_version_id, v_version_number;
end;
$$;

comment on function public.create_new_quote_version(
  uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean
) is
  'Story 10.6 atomic new-version RPC. It independently reconciles category VAT, allocation buckets, deductions and payable against actual line facts and the stored calculation tax input; sent/accepted prior versions are not recomputed.';

revoke execute on function public.create_new_quote_version(
  uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean
) from public;
grant execute on function public.create_new_quote_version(
  uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean
) to authenticated, service_role;
