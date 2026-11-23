import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Chinese Tour copy consistently uses the full name 小德兔", () => {
  const source = readFileSync(new URL("../components/museum/tour/TourTab.jsx", import.meta.url), "utf8");
  assert.match(source, /小德兔/u);
  assert.doesNotMatch(source, /小德(?!兔)/u);
});
