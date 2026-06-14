import { formatMove, parseAlg, type Move } from "./alg.js";
import { applyAlg, applyMove, getNetState, SOLVED_STATE, type CubeState, type NetState } from "./cube.js";
import { solveHumanLayer, type HumanSolution, type HumanStep } from "./human.js";
import { generateUfrScrambleText } from "./scramble.js";
import { solveAllLayers, type LayerSolution } from "./solver.js";

type SolveMode = "optimal" | "human";

interface AppState {
  scrambles: string[];
  index: number;
  mode: SolveMode;
  errorText: string;
  solvedScramble: string;
  scrambledState?: CubeState;
  solutions: LayerSolution[];
  humanSolution?: HumanSolution;
  revealedHumanSteps: number;
  isSolving: boolean;
}

const state: AppState = {
  scrambles: Array.from({ length: 12 }, () => generateUfrScrambleText()),
  index: 0,
  mode: "optimal",
  errorText: "",
  solvedScramble: "",
  solutions: [],
  revealedHumanSteps: 0,
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
            <div class="mode-tabs" role="group" aria-label="求解模式">
              <button class="mode-tab ${state.mode === "optimal" ? "active" : ""}" data-mode="optimal" type="button">Optimal Mode</button>
              <button class="mode-tab ${state.mode === "human" ? "active" : ""}" data-mode="human" type="button">Human Mode</button>
            </div>
            <button class="primary-button" data-action="solve" type="button" ${state.isSolving ? "disabled" : ""}>
              ${state.isSolving ? `<span class="spinner" aria-hidden="true"></span> 求解中...` : "确认开始求解"}
            </button>
          </div>

          <div class="meta">
            <span>公式序号：${state.index + 1} / ${state.scrambles.length}</span>
            <span>生成规则：U / R / F，8-10 步，支持 2 和 '</span>
            <span>${state.mode === "optimal" ? "最优解模式：按步数排序输出全部底色。" : "人类训练模式：优先构建逻辑，并逐步显示答案。"}</span>
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

  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode as SolveMode;
      clearOutput();
      render();
    });
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

  app.querySelector<HTMLButtonElement>('[data-action="reveal-human-step"]')?.addEventListener("click", () => {
    state.revealedHumanSteps += 1;
    render();
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
    if (state.mode === "optimal") {
      state.solutions = solveAllLayers(cubeState, { maxDepth: 8 });
      state.humanSolution = undefined;
    } else {
      state.humanSolution = solveHumanLayer(cubeState, 8);
      state.solutions = [];
      state.revealedHumanSteps = 0;
    }
    state.errorText = "";
  } catch (error) {
    state.solutions = [];
    state.humanSolution = undefined;
    state.scrambledState = undefined;
    state.solvedScramble = "";
    state.errorText = error instanceof Error ? error.message : String(error);
  }
}

function clearOutput(): void {
  state.solutions = [];
  state.humanSolution = undefined;
  state.revealedHumanSteps = 0;
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
        <h2>${state.mode === "optimal" ? "全部底色求解" : "Human Mode 人类训练"}</h2>
        <div class="loading-box"><span class="spinner" aria-hidden="true"></span> 正在计算答案...</div>
      </section>
    `;
  }

  if (!state.scrambledState) return "";

  if (state.mode === "human") return renderHumanSolution(state.scrambledState);

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

function renderHumanSolution(startState: CubeState): string {
  if (!state.humanSolution) {
    return `
      <section class="result-section">
        <h2>Human Mode 人类训练</h2>
        <p class="empty-result">在深度 8 内没有找到适合训练的完整底层方案。</p>
      </section>
    `;
  }

  const solution = state.humanSolution;
  const revealedCount = Math.min(state.revealedHumanSteps, solution.steps.length);
  const currentIndex = revealedCount;
  const currentState = applyAlg(startState, solution.moves.slice(0, revealedCount));
  const revealedSteps = solution.steps.slice(0, revealedCount);
  const currentStep = solution.steps[currentIndex];

  return `
    <section class="result-section human-mode-section">
      <h2>Human Mode 人类训练</h2>
      <article class="human-summary">
        <p><strong>颜色：</strong>${escapeHtml(solution.colorName)}</p>
        <p><strong>总步数：</strong>${solution.depth}</p>
        <p><strong>说明：</strong>这里不直接展示完整公式。请先观察当前状态，再判断下一步最应该做什么。</p>
      </article>

      <section class="thinking-card">
        <h3>下一步思考提示</h3>
        ${renderNet(getNetState(currentState), "当前状态")}
        ${
          currentStep
            ? `
              <div class="question-box">
                <p>你下一步最应该做什么？</p>
                <ol class="choice-list" type="A">
                  <li class="${currentStep.prompt.startsWith("A") ? "expected" : ""}">形成条</li>
                  <li class="${currentStep.prompt.startsWith("B") ? "expected" : ""}">插入块</li>
                  <li class="${currentStep.prompt.startsWith("C") ? "expected" : ""}">保护已有结构</li>
                  <li class="${currentStep.prompt.startsWith("D") ? "expected" : ""}">对齐颜色</li>
                </ol>
                <button class="secondary-button" data-action="reveal-human-step" type="button">显示本步答案</button>
              </div>
            `
            : `<p class="complete-message">训练完成：${escapeHtml(solution.colorName)}底层已经完整复原。</p>`
        }
      </section>

      <section class="revealed-plan">
        ${revealedSteps.map((step, index) => renderHumanStep(step, index + 1)).join("")}
      </section>
    </section>
  `;
}

function renderHumanStep(step: HumanStep, order: number): string {
  return `
    <article class="human-step-card">
      <header>
        <h3>目标${order}：${escapeHtml(step.goal)}</h3>
        <span class="move-pill">${escapeHtml(step.moveText)}</span>
      </header>
      <p><strong>原因：</strong>${escapeHtml(step.reason)}</p>
      <p><strong>步骤：</strong>${escapeHtml(step.moveText)}</p>
      <div class="state-change">
        <p><strong>状态变化展示</strong></p>
        <p>Step ${order}: ${escapeHtml(step.moveText)}</p>
        <p>完成块：${step.before.completedBlocks} → ${step.after.completedBlocks}</p>
        <p>形成条：${step.after.hasBar ? `是（${escapeHtml(step.after.barLabel ?? "已形成条")}` + "）" : "否"}</p>
        <p>完整面：${step.after.hasFullFace ? "是" : "否"}</p>
        <p>是否破坏已有结构：${step.destroyedStructure ? "是" : "否"}</p>
      </div>
    </article>
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
