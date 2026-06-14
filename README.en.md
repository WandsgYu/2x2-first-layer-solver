# 2x2 First Layer Solver

A small TypeScript solver for the 2x2 Rubik's Cube / Pocket Cube. It does not solve the whole cube; it searches for the shortest move sequence that restores one complete layer.

Keywords: `2x2 cube`, `Rubik's Cube`, `Pocket Cube`, `first layer solver`, `layer solver`, `BFS`, `WCA scramble`, `TypeScript`, `二阶魔方`, `魔方底层求解器`.

## What It Does

- Parses standard cube notation: `U D L R F B`, with `'` and `2`.
- Applies a scramble from the solved 2x2 state.
- Tries all 6 possible layer colors.
- Checks a complete layer, not just four same-color face stickers. The four corner pieces must be in the correct positions and orientations, including side colors.
- Uses BFS with simple pruning: no consecutive turns on the same face.
- Provides both a CLI and a minimal web UI.
- Adds Human Mode: instead of only minimizing move count, it favors construction-friendly solutions with step-by-step training prompts.

## Coordinate System

The fixed color scheme is:

- `U = white / 白色`
- `D = yellow / 黄色`
- `F = green / 绿色`
- `B = blue / 蓝色`
- `R = red / 红色`
- `L = orange / 橙色`

Solutions keep the original scrambled coordinate system. The cube is not reoriented when trying different target colors.

## Web UI

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The web UI can:

- Generate 8-10 move WCA-style `U / R / F` scrambles.
- Show previous and next scrambles.
- Show the scrambled cube as a flat net immediately.
- Optimal Mode: output all layer-color optimal solutions sorted by move count.
- Human Mode: recommend a more human-friendly construction path and ask what the next step should be before revealing the answer.
- Show a flat net after every move in each solution.

## CLI

```bash
npm run solve -- "R U R' U' F2"
```

Output example:

```text
底色：蓝色
步骤：U' F2 U
步数：3
完成效果：蓝色底层完整复原
```

All target colors:

```bash
npm run solve -- --all "U2 R2 F' U2 F2 U2 R F' U"
```

Increase BFS depth:

```bash
npm run solve -- --max-depth 9 "R U R' U' F2"
```

## Tests

```bash
npm test
```

The test suite includes parser checks, move consistency checks, inverse-scramble validation, solution validation, sorting validation, and a WCA-turn-direction regression case.

## Implementation Notes

- State model: 24 visible corner stickers.
- Search moves: all 18 face turns.
- Default BFS depth: `8`.
- Human Mode collects candidates near the optimal depth and rescales them using move count, face changes, structure damage, bar formation, and full-face formation.
- Not a full 2x2 solver. It intentionally stops once a complete layer is restored.
