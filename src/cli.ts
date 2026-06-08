#!/usr/bin/env node
import { parseAlg } from "./alg.js";
import { SOLVED_STATE, applyAlg } from "./cube.js";
import { formatLayerSolution, solveAllLayers, solveBestLayer } from "./solver.js";

interface CliOptions {
  scramble: string;
  all: boolean;
  maxDepth: number;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const scramble = parseAlg(options.scramble);
  const state = applyAlg(SOLVED_STATE, scramble);
  const solutions = options.all ? solveAllLayers(state, { maxDepth: options.maxDepth }) : [];
  const best = options.all ? undefined : solveBestLayer(state, { maxDepth: options.maxDepth });

  if (options.all) {
    if (solutions.length === 0) {
      console.log(`在深度 ${options.maxDepth} 内没有找到任何完整底层。`);
      return;
    }
    console.log(solutions.map(formatLayerSolution).join("\n\n"));
    return;
  }

  if (!best) {
    console.log(`在深度 ${options.maxDepth} 内没有找到完整底层。可以用 --max-depth 调高搜索深度。`);
    return;
  }

  console.log(formatLayerSolution(best));
}

function parseArgs(args: string[]): CliOptions {
  let all = false;
  let maxDepth = 8;
  const scrambleParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--all") {
      all = true;
    } else if (arg === "--max-depth") {
      const value = args[index + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error("--max-depth 后面需要一个正整数。");
      }
      maxDepth = Number(value);
      index += 1;
    } else {
      scrambleParts.push(arg);
    }
  }

  return {
    scramble: scrambleParts.join(" "),
    all,
    maxDepth,
  };
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`错误：${message}`);
  process.exitCode = 1;
}
