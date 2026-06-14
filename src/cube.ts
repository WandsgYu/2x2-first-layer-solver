import type { Face, Move } from "./alg.js";

export type CubeState = string;

type Vec3 = readonly [number, number, number];

interface Sticker {
  position: Vec3;
  normal: Vec3;
  color: Face;
}

export interface LayerAnalysis {
  face: Face;
  colorName: string;
  completedBlocks: number;
  hasBar: boolean;
  barLabel?: string;
  hasFullFace: boolean;
  isCompleteLayer: boolean;
}

const FACE_NORMALS: Record<Face, Vec3> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

const FACE_AXIS: Record<Face, 0 | 1 | 2> = {
  R: 0,
  L: 0,
  U: 1,
  D: 1,
  F: 2,
  B: 2,
};

const FACE_LAYER: Record<Face, number> = {
  R: 1,
  L: -1,
  U: 1,
  D: -1,
  F: 1,
  B: -1,
};

// Quarter-turn signs are chosen for standard Singmaster face turns in the fixed
// color scheme U=white, D=yellow, F=green, B=blue, R=red, L=orange.
const FACE_QUARTER_SIGN: Record<Face, 1 | -1> = {
  U: -1,
  D: 1,
  R: -1,
  L: 1,
  F: -1,
  B: 1,
};

const STICKERS: Sticker[] = buildStickers();
const KEY_TO_INDEX = new Map(STICKERS.map((sticker, index) => [stickerKey(sticker.position, sticker.normal), index]));
const MOVE_PERMS = buildMovePermutations();

export const SOLVED_STATE: CubeState = STICKERS.map((sticker) => sticker.color).join("");

export const FACE_COLOR_NAMES: Record<Face, string> = {
  U: "白色",
  D: "黄色",
  F: "绿色",
  B: "蓝色",
  R: "红色",
  L: "橙色",
};

export const ALL_FACES: Face[] = ["U", "D", "F", "B", "R", "L"];
export const SEARCH_MOVES: Move[] = ["U", "R", "F", "D", "L", "B"].flatMap((face) => [
  { face: face as Face, amount: 1 },
  { face: face as Face, amount: 3 },
  { face: face as Face, amount: 2 },
]);

export function applyMove(state: CubeState, move: Move): CubeState {
  let next = state;
  for (let i = 0; i < move.amount; i += 1) {
    next = applyQuarterTurn(next, move.face);
  }
  return next;
}

export function applyAlg(state: CubeState, moves: Move[]): CubeState {
  return moves.reduce((current, move) => applyMove(current, move), state);
}

export function isSolved(state: CubeState): boolean {
  return state === SOLVED_STATE;
}

export function isLayerSolved(state: CubeState, face: Face): boolean {
  const axis = FACE_AXIS[face];
  const layer = FACE_LAYER[face];

  return STICKERS.every((sticker, index) => {
    if (sticker.position[axis] !== layer) return true;
    return state[index] === SOLVED_STATE[index];
  });
}

export function solvedLayerFaces(state: CubeState): Face[] {
  return ALL_FACES.filter((face) => isLayerSolved(state, face));
}

export function analyzeLayer(state: CubeState, face: Face): LayerAnalysis {
  const cornerPositions = targetLayerCornerPositions(face);
  const completedCorners = cornerPositions.filter((position) => isCornerSolvedAt(state, position));
  const bar = findLayerBar(completedCorners, face);

  return {
    face,
    colorName: FACE_COLOR_NAMES[face],
    completedBlocks: completedCorners.length,
    hasBar: bar !== undefined,
    barLabel: bar,
    hasFullFace: faceStickers(state, face).every((color) => color === face),
    isCompleteLayer: completedCorners.length === 4,
  };
}

export type NetState = Record<Face, Face[]>;

export function getNetState(state: CubeState): NetState {
  return {
    U: stickersForFace(state, "U", (sticker) => [sticker.position[2], sticker.position[0]], [1, 1]),
    L: stickersForFace(state, "L", (sticker) => [-sticker.position[1], sticker.position[2]], [1, 1]),
    F: stickersForFace(state, "F", (sticker) => [-sticker.position[1], sticker.position[0]], [1, 1]),
    R: stickersForFace(state, "R", (sticker) => [-sticker.position[1], -sticker.position[2]], [1, 1]),
    B: stickersForFace(state, "B", (sticker) => [-sticker.position[1], -sticker.position[0]], [1, 1]),
    D: stickersForFace(state, "D", (sticker) => [-sticker.position[2], sticker.position[0]], [1, 1]),
  };
}

function applyQuarterTurn(state: CubeState, face: Face): CubeState {
  const perm = MOVE_PERMS[face];
  const next = new Array<string>(state.length);

  for (let newIndex = 0; newIndex < perm.length; newIndex += 1) {
    next[newIndex] = state[perm[newIndex]];
  }

  return next.join("");
}

function buildStickers(): Sticker[] {
  const stickers: Sticker[] = [];
  const values = [-1, 1];

  for (const x of values) {
    for (const y of values) {
      for (const z of values) {
        const position: Vec3 = [x, y, z];
        for (const [face, normal] of Object.entries(FACE_NORMALS) as [Face, Vec3][]) {
          const axis = FACE_AXIS[face];
          if (position[axis] === FACE_LAYER[face]) {
            stickers.push({ position, normal, color: face });
          }
        }
      }
    }
  }

  return stickers;
}

function buildMovePermutations(): Record<Face, number[]> {
  const result = {} as Record<Face, number[]>;

  for (const face of Object.keys(FACE_NORMALS) as Face[]) {
    const axis = FACE_AXIS[face];
    const layer = FACE_LAYER[face];
    const sign = FACE_QUARTER_SIGN[face];
    const perm = STICKERS.map((_, index) => index);

    for (const [oldIndex, sticker] of STICKERS.entries()) {
      if (sticker.position[axis] !== layer) continue;

      const newPosition = rotate(sticker.position, axis, sign);
      const newNormal = rotate(sticker.normal, axis, sign);
      const newIndex = KEY_TO_INDEX.get(stickerKey(newPosition, newNormal));
      if (newIndex === undefined) {
        throw new Error(`Internal move table error for ${face}.`);
      }
      perm[newIndex] = oldIndex;
    }

    result[face] = perm;
  }

  return result;
}

function targetLayerCornerPositions(face: Face): Vec3[] {
  const axis = FACE_AXIS[face];
  const layer = FACE_LAYER[face];
  const values = [-1, 1];
  const positions: Vec3[] = [];

  for (const x of values) {
    for (const y of values) {
      for (const z of values) {
        const position: Vec3 = [x, y, z];
        if (position[axis] === layer) positions.push(position);
      }
    }
  }

  return positions;
}

function isCornerSolvedAt(state: CubeState, position: Vec3): boolean {
  return STICKERS.every((sticker, index) => {
    if (!vecEquals(sticker.position, position)) return true;
    return state[index] === SOLVED_STATE[index];
  });
}

function findLayerBar(completedCorners: Vec3[], face: Face): string | undefined {
  for (let i = 0; i < completedCorners.length; i += 1) {
    for (let j = i + 1; j < completedCorners.length; j += 1) {
      const sharedFace = sharedSideFace(completedCorners[i], completedCorners[j], face);
      if (sharedFace) return `${FACE_COLOR_NAMES[face].replace("色", "")}${FACE_COLOR_NAMES[sharedFace].replace("色", "")}条`;
    }
  }

  return undefined;
}

function sharedSideFace(a: Vec3, b: Vec3, targetFace: Face): Face | undefined {
  const targetAxis = FACE_AXIS[targetFace];
  let diffCount = 0;
  let sameSideAxis: 0 | 1 | 2 | undefined;

  for (const axis of [0, 1, 2] as const) {
    if (axis === targetAxis) continue;
    if (a[axis] !== b[axis]) {
      diffCount += 1;
    } else {
      sameSideAxis = axis;
    }
  }

  if (diffCount !== 1 || sameSideAxis === undefined) return undefined;
  return faceFromAxisLayer(sameSideAxis, a[sameSideAxis]);
}

function faceFromAxisLayer(axis: 0 | 1 | 2, layer: number): Face {
  if (axis === 0) return layer === 1 ? "R" : "L";
  if (axis === 1) return layer === 1 ? "U" : "D";
  return layer === 1 ? "F" : "B";
}

function faceStickers(state: CubeState, face: Face): Face[] {
  return STICKERS
    .map((sticker, index) => ({ sticker, index }))
    .filter(({ sticker }) => vecEquals(sticker.normal, FACE_NORMALS[face]))
    .map(({ index }) => state[index] as Face);
}

function stickersForFace(
  state: CubeState,
  face: Face,
  sortKey: (sticker: Sticker) => [number, number],
  direction: [1 | -1, 1 | -1],
): Face[] {
  return STICKERS
    .map((sticker, index) => ({ sticker, index }))
    .filter(({ sticker }) => vecEquals(sticker.normal, FACE_NORMALS[face]))
    .sort((a, b) => {
      const [rowA, colA] = sortKey(a.sticker);
      const [rowB, colB] = sortKey(b.sticker);
      return direction[0] * (rowA - rowB) || direction[1] * (colA - colB);
    })
    .map(({ index }) => state[index] as Face);
}

function vecEquals(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function rotate(vector: Vec3, axis: 0 | 1 | 2, sign: 1 | -1): Vec3 {
  const [x, y, z] = vector;

  if (axis === 0) return [x, -sign * z, sign * y];
  if (axis === 1) return [sign * z, y, -sign * x];
  return [-sign * y, sign * x, z];
}

function stickerKey(position: Vec3, normal: Vec3): string {
  return `${position.join(",")}|${normal.join(",")}`;
}
