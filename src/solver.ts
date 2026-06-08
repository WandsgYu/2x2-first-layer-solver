import { formatAlg, type Face, type Move } from "./alg.js";
import { ALL_FACES, FACE_COLOR_NAMES, SEARCH_MOVES, isLayerSolved, solvedLayerFaces, type CubeState } from "./cube.js";

export interface LayerSolution {
  face: Face;
  colorName: string;
  moves: Move[];
  moveText: string;
  depth: number;
}

export interface SolveOptions {
  maxDepth?: number;
  targetFaces?: Face[];
}

interface QueueItem {
  state: CubeState;
  moves: Move[];
  lastFace?: Face;
}

export function solveAllLayers(start: CubeState, options: SolveOptions = {}): LayerSolution[] {
  const maxDepth = options.maxDepth ?? 8;
  const targetFaces = options.targetFaces ?? ALL_FACES;
  const remaining = new Set(targetFaces);
  const solutions = new Map<Face, Move[]>();

  for (const face of solvedLayerFaces(start)) {
    if (remaining.has(face)) {
      solutions.set(face, []);
      remaining.delete(face);
    }
  }

  const queue: QueueItem[] = [{ state: start, moves: [] }];
  const visited = new Set<CubeState>([start]);
  let head = 0;

  while (head < queue.length && remaining.size > 0) {
    const item = queue[head];
    head += 1;

    if (item.moves.length >= maxDepth) continue;

    for (const move of SEARCH_MOVES) {
      if (item.lastFace === move.face) continue;

      const nextState = applyCachedMove(item.state, move);
      if (visited.has(nextState)) continue;
      visited.add(nextState);

      const nextMoves = [...item.moves, move];
      for (const face of [...remaining]) {
        if (isLayerSolved(nextState, face)) {
          solutions.set(face, nextMoves);
          remaining.delete(face);
        }
      }

      queue.push({ state: nextState, moves: nextMoves, lastFace: move.face });
    }
  }

  return targetFaces
    .filter((face) => solutions.has(face))
    .map((face) => buildSolution(face, solutions.get(face)!))
    .sort((a, b) => a.depth - b.depth || a.face.localeCompare(b.face));
}

export function solveBestLayer(start: CubeState, options: SolveOptions = {}): LayerSolution | undefined {
  return solveAllLayers(start, options)[0];
}

export function formatLayerSolution(solution: LayerSolution): string {
  const steps = solution.moveText || "(无需转动)";
  return [
    `底色：${solution.colorName}`,
    `步骤：${steps}`,
    `步数：${solution.depth}`,
    `完成效果：${solution.colorName}底层完整复原`,
  ].join("\n");
}

function buildSolution(face: Face, moves: Move[]): LayerSolution {
  return {
    face,
    colorName: FACE_COLOR_NAMES[face],
    moves,
    moveText: formatAlg(moves),
    depth: moves.length,
  };
}

import { applyMove } from "./cube.js";

function applyCachedMove(state: CubeState, move: Move): CubeState {
  return applyMove(state, move);
}
