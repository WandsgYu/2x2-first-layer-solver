import type { Face, Move, TurnAmount } from "./alg.js";
import { formatAlg } from "./alg.js";

const SCRAMBLE_FACES: Face[] = ["U", "R", "F"];
const AMOUNTS: TurnAmount[] = [1, 2, 3];

export function generateUfrScramble(length = randomInt(8, 10)): Move[] {
  const moves: Move[] = [];
  let lastFace: Face | undefined;

  while (moves.length < length) {
    const face = pick(SCRAMBLE_FACES);
    if (face === lastFace) continue;

    moves.push({ face, amount: pick(AMOUNTS) });
    lastFace = face;
  }

  return moves;
}

export function generateUfrScrambleText(length?: number): string {
  return formatAlg(generateUfrScramble(length));
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
