/** TEST-ONLY: preserve safe error stages and boolean guard witnesses, never signing data. */
import { adminQuery } from "../factories/admin-sql";
import type { TestServerClient } from "../factories/tenants";

export type QuoteSendDiagnostic = {
  readonly rpc: string;
  readonly code: string;
  readonly message: string;
  readonly guards?: Record<string, boolean | null>;
  readonly timing?: { issued_delta_ms: number | null; expiry_delta_ms: number | null; prepared_to_finalization_ms: number | null };
};
const SEND_RPCS = new Set([
  "prepare_quote_pdf_send_attestation", "authorize_quote_final_send",
  "finalize_quote_email_delivery", "mark_quote_version_sent",
]);
const observers = new WeakMap<TestServerClient, ReturnType<typeof createObserver>>();
const SAFE_MESSAGES = new Set([
  "quote PDF send attestation is invalid",
  "current PDF is required before sending a governed quote version",
  "active PDF file is required before sending",
  "active PDF link is required before sending",
  "quote PDF file integrity metadata is invalid",
  "quote PDF Storage object is missing or does not match its metadata",
  "quote PDF attestation key is unavailable",
  "current PDF send attestation could not be prepared",
]);

/** Reuses observers installed by the authenticated fixture factory. */
export function observeQuoteSendRpcs(
  client: TestServerClient,
  onFailure?: (diagnostic: QuoteSendDiagnostic) => void,
) {
  const existing = observers.get(client);
  if (existing) return existing;
  const observer = createObserver(client, onFailure);
  observers.set(client, observer);
  observers.set(observer.client, observer);
  return observer;
}

function createObserver(
  client: TestServerClient,
  onFailure?: (diagnostic: QuoteSendDiagnostic) => void,
) {
  const diagnostics: QuoteSendDiagnostic[] = [];
  const prepared = new Map<unknown, Record<string, unknown>>();
  const preparedReceipt = new Map<unknown, number>();
  const observed = new Proxy(client, {
    get(target, property) {
      if (property !== "rpc") {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (name: string, args: Record<string, unknown>) => {
        const query = target.rpc(name, args);
        // Keep the actual lazy Postgrest builder and every fluent method. Only
        // these four send RPCs are observed; unrelated queries are untouched.
        if (!SEND_RPCS.has(name)) return query;
        const originalThen = query.then.bind(query);
        query.then = ((onFulfilled, onRejected) => originalThen(async (result) => {
        const receipt = preparedReceipt.get(args.p_correlation_id);
        const elapsed = receipt !== undefined && ["finalize_quote_email_delivery", "mark_quote_version_sent"].includes(name)
          ? performance.now() - receipt : null;
        if (name === "prepare_quote_pdf_send_attestation" && !result.error) {
          preparedReceipt.set(args.p_correlation_id, performance.now());
          prepared.set(args.p_correlation_id,
            (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>);
        }
        if (result.error) {
          const diagnostic: QuoteSendDiagnostic = {
            rpc: name, code: /^[A-Z0-9]{5}$/.test(result.error.code) ? result.error.code : "RPC_ERROR",
            message: SAFE_MESSAGES.has(result.error.message) ? result.error.message : "command RPC failed",
          };
          if (["prepare_quote_pdf_send_attestation", "finalize_quote_email_delivery", "mark_quote_version_sent"].includes(name)) {
            try {
              // Parameters remain in memory/DB only. The result contains no identifier,
              // timestamp, key, signature or canonical payload, only boolean witnesses.
              const [guards] = await adminQuery<Record<string, boolean | number | null>>(`
                select qv.status='draft' as draft, qv.pdf_status='generated' as generated,
                  qv.pdf_content_fingerprint=public.quote_version_content_fingerprint(qv.id) as fingerprint_matches,
                  f.archived_at is null and f.lifecycle_state in ('linked','locked') as file_active,
                  exists(select 1 from storage.objects o where o.bucket_id=f.bucket_id and o.name=f.object_path
                    and o.metadata->>'mimetype'=f.mime_type and o.metadata->>'size'=f.size_bytes::text) as storage_matches,
                  exists(select 1 from public.file_links l where l.tenant_id=qv.tenant_id and l.file_id=f.id
                    and l.owner_id=qv.id and l.owner_type='quote_version' and l.purpose='quote_pdf' and l.archived_at is null) as link_active,
                  $6::text=public.quote_pdf_attestation_iso($6::timestamptz) as issued_canonical,
                  $7::text=public.quote_pdf_attestation_iso($7::timestamptz) as expiry_canonical,
                  $7::timestamptz=$6::timestamptz+interval '5 minutes' as exact_window,
                  $6::timestamptz<=statement_timestamp() and $7::timestamptz>statement_timestamp() as time_current,
                  (extract(epoch from (statement_timestamp()-$6::timestamptz))*1000)::double precision as issued_delta_ms,
                  (extract(epoch from ($7::timestamptz-statement_timestamp()))*1000)::double precision as expiry_delta_ms,
                  $6::text=$10::text as issued_matches_prepared,
                  $6::timestamptz<=statement_timestamp() as issued_not_future,
                  $7::timestamptz>statement_timestamp() as expiry_not_past,
                  $6::timestamptz>statement_timestamp() and $6::timestamptz<=statement_timestamp()+interval '1 second' as issued_future_under_second,
                  $7::timestamptz<=statement_timestamp() and $7::timestamptz>statement_timestamp()-interval '1 second' as expiry_past_under_second,
                  public.quote_pdf_attestation_iso(qv.pdf_generated_at)=$9::text as generation_matches,
                  case when $8::text is null then null else encode(extensions.hmac(
                    public.quote_pdf_attestation_payload(qv.tenant_id,$3::uuid,qv.id,f.id,qv.pdf_content_fingerprint,
                      f.bucket_id,f.object_path,f.checksum,f.size_bytes,f.mime_type,$4::uuid,$5::text,
                      $6::timestamptz,$7::timestamptz,qv.pdf_generated_at),
                    convert_to(public.quote_pdf_attestation_vault_secret($5::text),'UTF8'),'sha256'),'hex')=$8::text end as hmac_matches
                from public.quote_versions qv left join public.files f on f.id=qv.pdf_file_id and f.tenant_id=qv.tenant_id
                where qv.tenant_id=$1::uuid and qv.id=$2::uuid`, [
                  args.p_tenant_id, args.p_quote_version_id, args.p_actor_user_id, args.p_correlation_id,
                  args.p_attestation_key_id ?? null, args.p_attestation_issued_at ?? null,
                  args.p_attestation_expires_at ?? null, args.p_attestation_signature ?? null,
                  prepared.get(args.p_correlation_id)?.generation_started_at ?? null,
                  prepared.get(args.p_correlation_id)?.attestation_issued_at ?? null,
                ]);
              if (guards) {
                const { issued_delta_ms, expiry_delta_ms, ...booleanGuards } = guards;
                diagnostics.push({ ...diagnostic,
                  guards: booleanGuards as Record<string, boolean | null>,
                  timing: { issued_delta_ms: issued_delta_ms as number | null,
                    expiry_delta_ms: expiry_delta_ms as number | null, prepared_to_finalization_ms: elapsed },
                });
              } else diagnostics.push({ ...diagnostic, guards: { row_present: false } });
            } catch { diagnostics.push({ ...diagnostic, guards: { readback_available: false } }); }
          } else diagnostics.push(diagnostic);
        }
        if (diagnostics.length > 0 && result.error) {
          // Emit only the fixed safe shape. Diagnostic failures cannot change
          // the SDK response or replace the originating command error.
          try { onFailure?.(diagnostics.at(-1)!); } catch { /* observational only */ }
          if (diagnostics.length > 10) diagnostics.shift();
        }
        if (["finalize_quote_email_delivery", "mark_quote_version_sent"].includes(name)) {
          prepared.delete(args.p_correlation_id);
          preparedReceipt.delete(args.p_correlation_id);
        }
        return result;
        }).then(onFulfilled, onRejected)) as typeof query.then;
        return query;
      };
    },
  });
  return { client: observed, diagnostics };
}
