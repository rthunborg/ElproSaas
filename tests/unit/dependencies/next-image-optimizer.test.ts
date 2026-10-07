import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const { optimizeImage }: typeof import("next/dist/server/image-optimizer") = require("next/dist/server/image-optimizer");
const color = { r: 230, g: 40, b: 70 };

async function assertPixels(buffer: Buffer, format: string, tolerance: number) {
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, format);
  assert.equal(metadata.width, 8);
  assert.equal(metadata.height, 4);
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3);
  const expected = [color.r, color.g, color.b];
  for (let index = 0; index < data.length; index += 1) {
    assert.ok(Math.abs(data[index] - expected[index % 3]!) <= tolerance, `channel ${index} differs from the solid fixture`);
  }
}

test("installed Next optimizer resizes and encodes a sharp-generated PNG as WebP with matching pixels", async () => {
  const input = await sharp({ create: { width: 16, height: 8, channels: 3, background: color } }).png().toBuffer();
  const output = await optimizeImage({ buffer: input, contentType: "image/webp", quality: 90, width: 8 });
  await assertPixels(output, "webp", 8);
});

test("installed Next optimizer decodes a synthetic SVG through sharp librsvg and returns resized PNG pixels", async () => {
  const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"><rect width="16" height="8" fill="rgb(230,40,70)"/></svg>');
  const output = await optimizeImage({ buffer: input, contentType: "image/png", quality: 100, width: 8 });
  await assertPixels(output, "png", 0);
});
