import assert from "node:assert/strict";
import { test } from "node:test";

import { formatRequiredStackError } from "../../support/global-setup";

test("required-stack failure includes only the sanitized reachability diagnostic", () => {
  const message = formatRequiredStackError({
    surface: "auth",
    method: "GET",
    origin: "http://127.0.0.1:55421",
    status: 503,
    elapsed_ms: 2_017,
    reason: "http_status",
    attempts: 1,
  });

  assert.match(message, /surface=auth method=GET origin=http:\/\/127\.0\.0\.1:55421 status=503 elapsed_ms=2017 reason=http_status attempts=1/);
  assert.doesNotMatch(message, /apikey|authorization|bearer|secret/i);
});
