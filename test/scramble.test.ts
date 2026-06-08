import assert from "node:assert/strict";
import test from "node:test";
import { parseAlg } from "../src/alg.js";
import { generateUfrScrambleText } from "../src/scramble.js";

test("generated scrambles use only U/R/F and WCA suffixes", () => {
  for (let i = 0; i < 100; i += 1) {
    const scramble = parseAlg(generateUfrScrambleText());
    assert.ok(scramble.length >= 8 && scramble.length <= 10);

    for (let moveIndex = 0; moveIndex < scramble.length; moveIndex += 1) {
      assert.match(scramble[moveIndex].face, /^[URF]$/);
      assert.ok([1, 2, 3].includes(scramble[moveIndex].amount));

      if (moveIndex > 0) {
        assert.notEqual(scramble[moveIndex].face, scramble[moveIndex - 1].face);
      }
    }
  }
});
