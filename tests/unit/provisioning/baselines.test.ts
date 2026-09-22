import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalProvisioningBaselineContent,
  provisioningBaselineContentHash,
} from "@/server/provisioning/baselines";

test("[P0] 12.1 canonical provisioning baseline JSON is key-order independent and compact", () => {
  const left = { version: 1, id: "standard-se", nested: { z: true, a: ["SEK", null] } };
  const right = { nested: { a: ["SEK", null], z: true }, id: "standard-se", version: 1 };
  assert.equal(
    canonicalProvisioningBaselineContent(left),
    '{"id":"standard-se","nested":{"a":["SEK",null],"z":true},"version":1}',
  );
  assert.equal(provisioningBaselineContentHash(left), provisioningBaselineContentHash(right));
});
