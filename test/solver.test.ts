import assert from "node:assert/strict";
import test from "node:test";
import { formatAlg, invertAlg, parseAlg } from "../src/alg.js";
import { SOLVED_STATE, applyAlg, applyMove, isLayerSolved, isSolved } from "../src/cube.js";
import { solveHumanLayer } from "../src/human.js";
import { solveAllLayers, solveBestLayer } from "../src/solver.js";

test("parse standard moves with prime and double suffixes", () => {
  assert.deepEqual(parseAlg("R U R' U' F2"), [
    { face: "R", amount: 1 },
    { face: "U", amount: 1 },
    { face: "R", amount: 3 },
    { face: "U", amount: 3 },
    { face: "F", amount: 2 },
  ]);
});

test("each move returns to solved after four quarter turns", () => {
  for (const face of ["U", "D", "L", "R", "F", "B"] as const) {
    let state = SOLVED_STATE;
    for (let i = 0; i < 4; i += 1) {
      state = applyMove(state, { face, amount: 1 });
    }
    assert.equal(state, SOLVED_STATE);
  }
});

test("scramble followed by inverse returns solved", () => {
  const scramble = parseAlg("R U R' U' F2");
  const state = applyAlg(SOLVED_STATE, [...scramble, ...invertAlg(scramble)]);
  assert.equal(isSolved(state), true);
});

test("best layer solution restores a complete layer", () => {
  const scramble = parseAlg("R U R' U' F2");
  const scrambled = applyAlg(SOLVED_STATE, scramble);
  const solution = solveBestLayer(scrambled, { maxDepth: 8 });

  assert.ok(solution);
  const solvedLayerState = applyAlg(scrambled, solution.moves);
  assert.equal(isLayerSolved(solvedLayerState, solution.face), true);
});

test("all reported layer solutions are valid and sorted by depth", () => {
  const scramble = parseAlg("F R U R' U' F'");
  const scrambled = applyAlg(SOLVED_STATE, scramble);
  const solutions = solveAllLayers(scrambled, { maxDepth: 8 });

  assert.ok(solutions.length > 0);
  const depths = solutions.map((solution) => solution.depth);
  assert.deepEqual(
    depths,
    [...depths].sort((a, b) => a - b),
  );

  for (const solution of solutions) {
    const result = applyAlg(scrambled, solution.moves);
    assert.equal(isLayerSolved(result, solution.face), true, formatAlg(solution.moves));
  }
});

test("regression: U/D turns use standard WCA direction", () => {
  const scramble = parseAlg("U2 R2 F' U2 F2 U2 R F' U");
  const oldWrongSolution = parseAlg("U2 R F U2");
  const scrambled = applyAlg(SOLVED_STATE, scramble);
  const oldResult = applyAlg(scrambled, oldWrongSolution);

  assert.equal(isLayerSolved(oldResult, "L"), false);

  const solutions = solveAllLayers(scrambled, { maxDepth: 8 });
  assert.equal(solutions[0].colorName, "橙色");
  assert.equal(solutions[0].moveText, "R F U2");
});

test("human mode returns a valid explained layer solution", () => {
  const scramble = parseAlg("U2 R2 F' U2 F2 U2 R F' U");
  const scrambled = applyAlg(SOLVED_STATE, scramble);
  const solution = solveHumanLayer(scrambled, 8);

  assert.ok(solution);
  assert.equal(solution.steps.length, solution.moves.length);
  assert.ok(solution.score < Number.POSITIVE_INFINITY);

  const result = applyAlg(scrambled, solution.moves);
  assert.equal(isLayerSolved(result, solution.face), true);

  for (const step of solution.steps) {
    assert.ok(step.goal.length > 0);
    assert.ok(step.reason.length > 0);
    assert.match(step.prompt, /^[ABCD]\./);
  }
});
