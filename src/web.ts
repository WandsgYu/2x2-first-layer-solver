import { formatMove, parseAlg, type Move } from "./alg.js";
import { applyAlg, applyMove, getNetState, SOLVED_STATE, type CubeState, type NetState } from "./cube.js";
import { generateUfrScrambleText } from "./scramble.js";
import { solveAllLayers, type LayerSolution } from "./solver.js";

interface AppState {
  scrambles: string[];
  index: number;
  errorText: string;
  solvedScramble: string;
  scrambledState?: CubeState;
  solutions: LayerSolution[];
  isSolving: boolean;
}

const state: AppState = {
  scrambles: Array.from({ length: 12 }, () => generateUfrScrambleText()),
  index: 0,
  errorText: "",
  solvedScramble: "",
  solutions: [],
  isSolving: false,
};

const appElement = document.querySelector<HTMLDivElement>("#app");
if (!appElement) throw new Error("Missing #app element.");
const app = appElement;

render();

function render(): void {
  const scramble = state.scrambles[state.index];
  const preview = getScrambledPreview(scramble);

  app.innerHTML = `
    <section class="shell">
      <section class="sticky-workbench">
        <header class="topbar">
          <h1>二阶底层求解器</h1>
          <p>坐标：绿前黄底，打乱后不换坐标系。</p>
        </header>

        <section class="solver-panel">
          <div class="scramble-row">
            <button class="nav-button" data-action="prev" type="button">上一条公式</button>
            <input class="scramble-box" data-action="scramble-input" aria-label="打乱公式" value="${escapeHtml(scramble)}" />
            <button class="nav-button" data-action="next" type="button">下一条公式</button>
          </div>

          <div class="controls">
            <span class="coordinate-note">默认输出全部底色，并按步数从小到大排序。</span>
            <button class="primary-button" data-action="solve" type="button" ${state.isSolving ? "disabled" : ""}>
              ${state.isSolving ? `<span class="spinner" aria-hidden="true"></span> 求解中...` : "确认开始求解"}
            </button>
          </div>

          <div class="meta">
            <span>公式序号：${state.index + 1} / ${state.scrambles.length}</span>
            <span>生成规则：U / R / F，8-10 步，支持 2 和 '</span>
          </div>
        </section>

        ${state.errorText ? `<pre class="error">${escapeHtml(state.errorText)}</pre>` : ""}
        ${renderScrambledPreview(preview, scramble)}
      </section>

      ${renderSolutions()}
    </section>
  `;

  bindEvents();
}

function bindEvents(): void {
  app.querySelector<HTMLButtonElement>('[data-action="prev"]')?.addEventListener("click", () => {
    state.index = Math.max(0, state.index - 1);
    clearOutput();
    render();
  });

  app.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener("click", () => {
    if (state.index === state.scrambles.length - 1) {
      state.scrambles.push(generateUfrScrambleText());
    }
    state.index += 1;
    clearOutput();
    render();
  });

  app.querySelector<HTMLInputElement>('[data-action="scramble-input"]')?.addEventListener("input", (event) => {
    state.scrambles[state.index] = (event.currentTarget as HTMLInputElement).value;
    clearOutput();
    updateScrambledPreview();
    app.querySelector(".result-section")?.remove();
    app.querySelector(".error")?.remove();
  });

  app.querySelector<HTMLButtonElement>('[data-action="solve"]')?.addEventListener("click", () => {
    startSolvingCurrentScramble();
  });
}

function startSolvingCurrentScramble(): void {
  state.isSolving = true;
  state.errorText = "";
  state.solutions = [];
  state.scrambledState = undefined;
  state.solvedScramble = state.scrambles[state.index];
  render();

  window.setTimeout(() => {
    solveCurrentScramble();
    state.isSolving = false;
    render();
  }, 600);
}

function solveCurrentScramble(): void {
  try {
    const scramble = parseAlg(state.scrambles[state.index]);
    const cubeState = applyAlg(SOLVED_STATE, scramble);
    state.solvedScramble = state.scrambles[state.index];
    state.scrambledState = cubeState;
    state.solutions = solveAllLayers(cubeState, { maxDepth: 8 });
    state.errorText = "";
  } catch (error) {
    state.solutions = [];
    state.scrambledState = undefined;
    state.solvedScramble = "";
    state.errorText = error instanceof Error ? error.message : String(error);
  }
}

function clearOutput(): void {
  state.solutions = [];
  state.scrambledState = undefined;
  state.solvedScramble = "";
  state.errorText = "";
  state.isSolving = false;
}

function getScrambledPreview(scrambleText: string): { state?: CubeState; errorText?: string } {
  try {
    return {
      state: applyAlg(SOLVED_STATE, parseAlg(scrambleText)),
    };
  } catch (error) {
    return {
      errorText: error instanceof Error ? error.message : String(error),
    };
  }
}

function renderScrambledPreview(preview: { state?: CubeState; errorText?: string }, scramble: string): string {
  return `
    <section class="scrambled-preview">
      <h2>打乱后的魔方</h2>
      <p class="result-meta">公式：${escapeHtml(scramble)}</p>
      ${preview.state ? renderNet(getNetState(preview.state), "打乱后平面图") : `<p class="preview-error">公式暂时无法解析：${escapeHtml(preview.errorText ?? "")}</p>`}
    </section>
  `;
}

function updateScrambledPreview(): void {
  const previewElement = app.querySelector(".scrambled-preview");
  if (!previewElement) return;

  const scramble = state.scrambles[state.index];
  previewElement.outerHTML = renderScrambledPreview(getScrambledPreview(scramble), scramble);
}

function renderSolutions(): string {
  if (state.isSolving) {
    return `
      <section class="result-section">
        <h2>全部底色求解</h2>
        <div class="loading-box"><span class="spinner" aria-hidden="true"></span> 正在计算答案...</div>
      </section>
    `;
  }

  if (!state.scrambledState) return "";

  const solutionHtml = state.solutions.length > 0
    ? state.solutions.map((solution, index) => renderSolution(solution, index + 1, state.scrambledState!)).join("")
    : `<p class="empty-result">在深度 8 内没有找到任何完整底层。</p>`;

  return `
    <section class="result-section">
      <h2>全部底色求解</h2>
      ${solutionHtml}
    </section>
  `;
}

function renderSolution(solution: LayerSolution, order: number, startState: CubeState): string {
  const stepStates = buildStepStates(startState, solution.moves);

  return `
    <article class="solution-card">
      <header class="solution-header">
        <span>${order}. 底色：${escapeHtml(solution.colorName)}</span>
        <span>步数：${solution.depth}</span>
        <span>步骤：${escapeHtml(solution.moveText || "(无需转动)")}</span>
      </header>
      <p class="effect">完成效果：${escapeHtml(solution.colorName)}底层完整复原</p>
      <div class="step-net-list">
        ${stepStates.map(({ label, state: cubeState }) => renderNet(getNetState(cubeState), label)).join("")}
      </div>
    </article>
  `;
}

function buildStepStates(startState: CubeState, moves: Move[]): { label: string; state: CubeState }[] {
  const states: { label: string; state: CubeState }[] = [];
  let current = startState;

  for (let index = 0; index < moves.length; index += 1) {
    current = applyMove(current, moves[index]);
    states.push({
      label: `第 ${index + 1} 步：${formatMove(moves[index])}`,
      state: current,
    });
  }

  return states;
}

function renderNet(net: NetState, title: string): string {
  return `
    <figure class="net-figure">
      <figcaption>${escapeHtml(title)}</figcaption>
      <div class="cube-net" aria-label="${escapeHtml(title)}">
        <div class="face face-u">${renderFace(net.U, "U")}</div>
        <div class="face face-l">${renderFace(net.L, "L")}</div>
        <div class="face face-f">${renderFace(net.F, "F")}</div>
        <div class="face face-r">${renderFace(net.R, "R")}</div>
        <div class="face face-b">${renderFace(net.B, "B")}</div>
        <div class="face face-d">${renderFace(net.D, "D")}</div>
      </div>
    </figure>
  `;
}

function renderFace(stickers: NetState[keyof NetState], label: string): string {
  return `
    <span class="face-label">${label}</span>
    ${stickers.map((face) => `<span class="sticker color-${face}"></span>`).join("")}
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
