import { timingSafeEqual } from "node:crypto";
type CronEnvironment = { readonly CRON_SECRET?: string; readonly CRON_PREVIOUS_SECRET?: string; readonly CRON_PREVIOUS_SECRET_EXPIRES_AT?: string };
function equalSecret(candidate: string, expected?: string): boolean {
  if (!expected || expected.length < 32 || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}
/** Pure authentication boundary: no database or dispatch dependency may enter here. */
export function isAuthorizedCronRequest(header: string | null, env: CronEnvironment = process.env as CronEnvironment): boolean {
  const candidate = header?.match(/^Bearer ([^\s]+)$/)?.[1];
  // A rotation value is never an independent credential: an operator must retain a
  // valid current secret while its previous value is eligible.
  if (!candidate || !env.CRON_SECRET || env.CRON_SECRET.length < 32) return false;
  return equalSecret(candidate, env.CRON_SECRET) || Boolean(
    env.CRON_PREVIOUS_SECRET_EXPIRES_AT &&
    new Date(env.CRON_PREVIOUS_SECRET_EXPIRES_AT) > new Date() &&
    equalSecret(candidate, env.CRON_PREVIOUS_SECRET),
  );
}
