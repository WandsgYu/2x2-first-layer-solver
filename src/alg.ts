export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type TurnAmount = 1 | 2 | 3;

export interface Move {
  face: Face;
  amount: TurnAmount;
}

const FACE_SET = new Set(["U", "D", "L", "R", "F", "B"]);

export function parseAlg(input: string): Move[] {
  const moves: Move[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (!FACE_SET.has(char)) {
      throw new Error(`Invalid move face "${char}" at position ${index + 1}.`);
    }

    const face = char as Face;
    const suffix = input[index + 1];
    let amount: TurnAmount = 1;

    if (suffix === "2") {
      amount = 2;
      index += 1;
    } else if (suffix === "'") {
      amount = 3;
      index += 1;
    }

    const next = input[index + 1];
    if (next && !/\s/.test(next) && !FACE_SET.has(next)) {
      throw new Error(`Invalid move suffix "${next}" after ${face}.`);
    }

    moves.push({ face, amount });
    index += 1;
  }

  return moves;
}

export function formatMove(move: Move): string {
  if (move.amount === 2) return `${move.face}2`;
  if (move.amount === 3) return `${move.face}'`;
  return move.face;
}

export function formatAlg(moves: Move[]): string {
  return moves.map(formatMove).join(" ");
}

export function invertMove(move: Move): Move {
  return {
    face: move.face,
    amount: move.amount === 2 ? 2 : move.amount === 1 ? 3 : 1,
  };
}

export function invertAlg(moves: Move[]): Move[] {
  return [...moves].reverse().map(invertMove);
}
