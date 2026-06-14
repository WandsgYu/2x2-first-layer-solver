import { formatAlg, formatMove, type Face, type Move } from "./alg.js";
import {
  ALL_FACES,
  FACE_COLOR_NAMES,
  SEARCH_MOVES,
  analyzeLayer,
  applyMove,
  isLayerSolved,
  type CubeState,
  type LayerAnalysis,
} from "./cube.js";

export interface HumanStep {
  move: Move;
  moveText: string;
  goal: string;
  reason: string;
  prompt: string;
  answer: string;
  before: LayerAnalysis;
  after: LayerAnalysis;
  destroyedStructure: boolean;
}

export interface HumanSolution {
  face: Face;
  colorName: string;
  moves: Move[];
  moveText: string;
  depth: number;
  score: number;
  steps: HumanStep[];
}

interface QueueItem {
  state: CubeState;
  moves: Move[];
  lastFace?: Face;
}

interface Candidate {
  face: Face;
  moves: Move[];
  score: number;
}

export function solveHumanLayer(start: CubeState, maxDepth = 8): HumanSolution | undefined {
  const candidates = collectCandidates(start, maxDepth);
  const best = candidates.sort((a, b) => a.score - b.score || a.moves.length - b.moves.length || a.face.localeCompare(b.face))[0];
  if (!best) return undefined;

  return buildHumanSolution(start, best.face, best.moves, best.score);
}

export function collectHumanSolutions(start: CubeState, maxDepth = 8, limit = 6): HumanSolution[] {
  return collectCandidates(start, maxDepth)
    .sort((a, b) => a.score - b.score || a.moves.length - b.moves.length || a.face.localeCompare(b.face))
    .slice(0, limit)
    .map((candidate) => buildHumanSolution(start, candidate.face, candidate.moves, candidate.score));
}

function collectCandidates(start: CubeState, maxDepth: number): Candidate[] {
  const candidates: Candidate[] = [];
  const queue: QueueItem[] = [{ state: start, moves: [] }];
  const visited = new Set<CubeState>([start]);
  const maxCandidateCount = 80;
  let firstSolutionDepth: number | undefined;
  let head = 0;

  for (const face of ALL_FACES) {
    if (isLayerSolved(start, face)) {
      candidates.push({ face, moves: [], score: scoreHumanPath(start, face, []) });
      firstSolutionDepth = 0;
    }
  }

  while (head < queue.length && candidates.length < maxCandidateCount) {
    const item = queue[head];
    head += 1;

    if (item.moves.length >= maxDepth) continue;
    if (firstSolutionDepth !== undefined && item.moves.length >= firstSolutionDepth + 3) continue;

    for (const move of SEARCH_MOVES) {
      if (item.lastFace === move.face) continue;

      const nextState = applyMove(item.state, move);
      if (visited.has(nextState)) continue;
      visited.add(nextState);

      const nextMoves = [...item.moves, move];
      for (const face of ALL_FACES) {
        if (isLayerSolved(nextState, face)) {
          firstSolutionDepth ??= nextMoves.length;
          candidates.push({
            face,
            moves: nextMoves,
            score: scoreHumanPath(start, face, nextMoves),
          });
        }
      }

      queue.push({ state: nextState, moves: nextMoves, lastFace: move.face });
    }
  }

  return candidates;
}

function scoreHumanPath(start: CubeState, face: Face, moves: Move[]): number {
  let score = moves.length;
  let state = start;
  let previous = analyzeLayer(state, face);
  let maxBlocks = previous.completedBlocks;
  let formedBarCount = 0;
  let formedFullFaceCount = 0;
  let destroyedCount = 0;
  let blockGain = 0;
  let awkwardCount = 0;

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    const nextState = applyMove(state, move);
    const next = analyzeLayer(nextState, face);

    if (index > 0) score += moves[index - 1].face === move.face ? 0 : 2;
    if (isAwkwardTurn(moves[index - 1], move)) awkwardCount += 1;
    if (next.completedBlocks < previous.completedBlocks || (previous.hasBar && !next.hasBar)) destroyedCount += 1;
    if (!previous.hasBar && next.hasBar) formedBarCount += 1;
    if (!previous.hasFullFace && next.hasFullFace) formedFullFaceCount += 1;
    if (next.completedBlocks > previous.completedBlocks) blockGain += next.completedBlocks - previous.completedBlocks;

    maxBlocks = Math.max(maxBlocks, next.completedBlocks);
    previous = next;
    state = nextState;
  }

  score += awkwardCount * 2;
  score += destroyedCount * 5;
  score -= formedBarCount * 4;
  score -= formedFullFaceCount * 3;
  score -= blockGain * 2;
  score -= maxBlocks;

  return score;
}

function buildHumanSolution(start: CubeState, face: Face, moves: Move[], score: number): HumanSolution {
  const steps: HumanStep[] = [];
  let state = start;

  for (const move of moves) {
    const before = analyzeLayer(state, face);
    const nextState = applyMove(state, move);
    const after = analyzeLayer(nextState, face);
    const destroyedStructure = after.completedBlocks < before.completedBlocks || (before.hasBar && !after.hasBar);
    const goal = describeGoal(before, after);

    steps.push({
      move,
      moveText: formatMove(move),
      goal,
      reason: describeReason(before, after, destroyedStructure),
      prompt: choosePrompt(before, after),
      answer: goal,
      before,
      after,
      destroyedStructure,
    });

    state = nextState;
  }

  return {
    face,
    colorName: FACE_COLOR_NAMES[face],
    moves,
    moveText: formatAlg(moves),
    depth: moves.length,
    score,
    steps,
  };
}

function describeGoal(before: LayerAnalysis, after: LayerAnalysis): string {
  if (after.isCompleteLayer) return "插入到底层";
  if (!before.hasFullFace && after.hasFullFace) return "形成完整面";
  if (!before.hasBar && after.hasBar) return "形成第一条";
  if (after.completedBlocks > before.completedBlocks && before.hasBar) return "连接第二条";
  if (after.completedBlocks > before.completedBlocks) return "插入块";
  if (before.completedBlocks > 0 && after.completedBlocks >= before.completedBlocks) return "保护已有结构";
  return "对齐颜色";
}

function describeReason(before: LayerAnalysis, after: LayerAnalysis, destroyedStructure: boolean): string {
  if (destroyedStructure) {
    return "这一步会临时移动已有结构，但换来后续更直接的配对或插入机会。";
  }

  if (!before.hasBar && after.hasBar) {
    return after.barLabel
      ? `将两个${after.colorName}角块移动到同一侧，形成${after.barLabel}，后续更容易整体插入。`
      : `将两个${after.colorName}角块移动到同一侧，创造可配对机会。`;
  }

  if (!before.hasFullFace && after.hasFullFace) {
    return `当前${after.colorName}贴纸已经可以组成完整面，这一步先把面做出来，再处理侧面位置。`;
  }

  if (after.completedBlocks > before.completedBlocks) {
    return `完成块从 ${before.completedBlocks} 增加到 ${after.completedBlocks}，说明这一步把一个角块放到了正确位置和朝向。`;
  }

  if (after.isCompleteLayer) {
    return `已有结构已经对齐，这一步把完整结构放到目标层。`;
  }

  return `这一步主要是在不破坏已有结构的前提下调整相对位置，为下一次配对或插入做准备。`;
}

function choosePrompt(before: LayerAnalysis, after: LayerAnalysis): string {
  if (!before.hasBar && after.hasBar) return "A. 形成条";
  if (after.completedBlocks > before.completedBlocks) return "B. 插入块";
  if (before.completedBlocks > 0 && after.completedBlocks >= before.completedBlocks) return "C. 保护已有结构";
  return "D. 对齐颜色";
}

function isAwkwardTurn(previous: Move | undefined, current: Move): boolean {
  if (!previous) return false;
  if (previous.face === current.face) return true;
  return moveAxis(previous.face) === moveAxis(current.face) && previous.amount !== 2 && current.amount !== 2;
}

function moveAxis(face: Face): "x" | "y" | "z" {
  if (face === "R" || face === "L") return "x";
  if (face === "U" || face === "D") return "y";
  return "z";
}
