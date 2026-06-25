import {
  constrainToWheel,
  diagramToSolver,
  localToGlobalSolver,
  solverLocalToUser,
  solverToDiagram,
  userLocalToSolver,
  wheelBOriginSolver,
} from './coords';
import type { InputState, Point2, PushOnlySolution, SolveResult, ValidSolution, WheelId } from './types';
import { hasPhysicsOutput } from './types';

/** Diagram colors for line of action and attachment points. */
const COLOR_VALID = '#B98429';
const COLOR_PUSH_ONLY = '#9FE6EA';
const COLOR_RADIUS_MISS = '#C4C4C4';

function physicsAccentColor(result: ValidSolution | PushOnlySolution): string {
  if (!result.radiusValidA || !result.radiusValidB) {
    return COLOR_RADIUS_MISS;
  }
  return result.kind === 'push-only' ? COLOR_PUSH_ONLY : COLOR_VALID;
}

export interface DiagramCallbacks {
  onWheelClick?: (wheel: WheelId, local: Point2) => void;
}

interface ViewTransform {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** Sizes in SVG user units (meters), scaled to the scene. */
interface DiagramStyle {
  pointRadius: number;
  axleRadius: number;
  lineStroke: number;
  gridStroke: number;
  wheelStroke: number;
  fontSize: number;
  labelOffset: number;
}

function diagramStyle(state: InputState): DiagramStyle {
  const scene = Math.max(state.dAB, state.rA, state.rB, 0.1);
  return {
    pointRadius: scene * 0.035,
    axleRadius: scene * 0.02,
    lineStroke: scene * 0.018,
    gridStroke: scene * 0.004,
    wheelStroke: scene * 0.012,
    fontSize: scene * 0.11,
    labelOffset: scene * 0.07,
  };
}

function computeViewTransform(state: InputState, result: SolveResult): ViewTransform {
  const dAB = state.dAB;
  const rMax = Math.max(state.rA, state.rB, 0.1);
  const points: Point2[] = [
    { x: -state.rA, y: -state.rA },
    { x: state.rA, y: state.rA },
    localToGlobalSolver('B', { x: -state.rB, y: -state.rB }, dAB),
    localToGlobalSolver('B', { x: state.rB, y: state.rB }, dAB),
    wheelBOriginSolver(dAB),
    { x: 0, y: 0 },
  ];

  if (hasPhysicsOutput(result)) {
    points.push(
      localToGlobalSolver('A', result.pA, dAB),
      localToGlobalSolver('B', result.pB, dAB),
    );
  }

  if (state.mode === 'coord') {
    points.push(localToGlobalSolver(state.coordWheel, { x: state.coordX, y: state.coordY }, dAB));
    if (state.secondCoordWheel !== undefined && state.secondCoordX !== undefined && state.secondCoordY !== undefined) {
      points.push(
        localToGlobalSolver(
          state.secondCoordWheel,
          { x: state.secondCoordX, y: state.secondCoordY },
          dAB,
        ),
      );
    }
  }

  const svgPoints = points.map(solverToDiagram);
  let minX = Math.min(...svgPoints.map((p) => p.x));
  let maxX = Math.max(...svgPoints.map((p) => p.x));
  let minY = Math.min(...svgPoints.map((p) => p.y));
  let maxY = Math.max(...svgPoints.map((p) => p.y));

  const pad = Math.max(rMax, dAB) * 0.25;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function globalSolverToDiagram(global: Point2): Point2 {
  return solverToDiagram(global);
}

function svgToLocalWheel(svg: Point2, wheel: WheelId, dAB: number): Point2 {
  const global = diagramToSolver(svg);
  if (wheel === 'A') return global;
  const o = wheelBOriginSolver(dAB);
  return { x: global.x - o.x, y: global.y - o.y };
}

function linePhysicsPoints(
  result: SolveResult,
  dAB: number,
  extent: number,
): [Point2, Point2] | null {
  if (!hasPhysicsOutput(result)) return null;

  if (result.isVertical && result.verticalC !== undefined) {
    const c = result.verticalC;
    const g1 = { x: c, y: -extent };
    const g2 = { x: c, y: extent + dAB };
    return [g1, g2];
  }

  if (result.m === undefined || result.bA === undefined) return null;
  const m = result.m;
  const bA = result.bA;
  const x1 = -extent;
  const x2 = extent;
  const g1 = { x: x1, y: m * x1 + bA };
  const g2 = { x: x2, y: m * x2 + bA };
  return [g1, g2];
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | undefined> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) node.setAttribute(k, String(v));
  }
  return node;
}

function drawGrid(svg: SVGSVGElement, view: ViewTransform, style: DiagramStyle): void {
  const g = el('g', { class: 'grid' });
  const step = niceStep(Math.max(view.width, view.height) / 10);
  const xStart = Math.floor(view.minX / step) * step;
  const xEnd = view.minX + view.width;
  const yStart = Math.floor(view.minY / step) * step;
  const yEnd = view.minY + view.height;

  for (let x = xStart; x <= xEnd; x += step) {
    g.appendChild(
      el('line', {
        x1: x,
        y1: view.minY,
        x2: x,
        y2: view.minY + view.height,
        stroke: '#e4e9f2',
        'stroke-width': style.gridStroke,
      }),
    );
  }
  for (let y = yStart; y <= yEnd; y += step) {
    g.appendChild(
      el('line', {
        x1: view.minX,
        y1: y,
        x2: view.minX + view.width,
        y2: y,
        stroke: '#e4e9f2',
        'stroke-width': style.gridStroke,
      }),
    );
  }
  svg.appendChild(g);
}

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  if (n < 1.5) return pow;
  if (n < 3.5) return 2 * pow;
  if (n < 7.5) return 5 * pow;
  return 10 * pow;
}

function drawHighlightRegion(
  svg: SVGSVGElement,
  wheel: WheelId,
  radius: number,
  dAB: number,
  style: DiagramStyle,
): void {
  const origin = wheel === 'A' ? { x: 0, y: 0 } : wheelBOriginSolver(dAB);
  const center = globalSolverToDiagram(origin);
  const g = el('g', { class: 'highlight-region' });
  const r = radius;
  const stripHalfWidth = radius * 0.04;

  // Full wheel fill minus narrow strip at x = 0 (local): draw as two arc wedges.
  const path = el('path', {
    d: [
      `M ${center.x + r} ${center.y}`,
      `A ${r} ${r} 0 1 0 ${center.x - r} ${center.y}`,
      `A ${r} ${r} 0 1 0 ${center.x + r} ${center.y}`,
      `M ${center.x + stripHalfWidth} ${center.y - r}`,
      `A ${r} ${r} 0 1 1 ${center.x + stripHalfWidth} ${center.y + r}`,
      `L ${center.x - stripHalfWidth} ${center.y + r}`,
      `A ${r} ${r} 0 1 1 ${center.x - stripHalfWidth} ${center.y - r}`,
      'Z',
    ].join(' '),
    'fill-rule': 'evenodd',
    stroke: '#27ae60',
    'stroke-width': style.gridStroke * 2,
  });
  g.appendChild(path);
  svg.appendChild(g);
}

function drawWheel(
  svg: SVGSVGElement,
  wheel: WheelId,
  radius: number,
  dAB: number,
  label: string,
  style: DiagramStyle,
): void {
  const origin = wheel === 'A' ? { x: 0, y: 0 } : wheelBOriginSolver(dAB);
  const center = globalSolverToDiagram(origin);
  const g = el('g', { class: `wheel wheel-${wheel.toLowerCase()}` });
  g.appendChild(
    el('circle', {
      cx: center.x,
      cy: center.y,
      r: radius,
      fill: 'none',
      stroke: '#4a6fa5',
      'stroke-width': style.wheelStroke,
    }),
  );
  g.appendChild(
    el('circle', {
      cx: center.x,
      cy: center.y,
      r: style.axleRadius,
      fill: '#2c3e50',
      stroke: 'none',
    }),
  );
  const text = el('text', {
    x: center.x - radius * 0.2,
    y: center.y + radius * 0.35,
    class: 'origin-label',
    'font-size': style.fontSize,
    fill: '#444',
  });
  text.textContent = label;
  g.appendChild(text);
  svg.appendChild(g);
}

function drawPoint(
  svg: SVGSVGElement,
  local: Point2,
  wheel: WheelId,
  dAB: number,
  label: string,
  fill: string,
  style: DiagramStyle,
): void {
  const global = localToGlobalSolver(wheel, local, dAB);
  const p = globalSolverToDiagram(global);
  const g = el('g', { class: 'diagram-point' });
  g.appendChild(
    el('circle', {
      cx: p.x,
      cy: p.y,
      r: style.pointRadius,
      fill,
      stroke: '#fff',
      'stroke-width': style.gridStroke * 2,
    }),
  );
  const text = el('text', {
    x: p.x + style.labelOffset,
    y: p.y - style.labelOffset,
    class: 'point-label',
    'font-size': style.fontSize,
    fill: '#444',
  });
  text.textContent = label;
  g.appendChild(text);
  svg.appendChild(g);
}

function drawLocalXAxis(
  svg: SVGSVGElement,
  wheel: WheelId,
  radius: number,
  dAB: number,
  style: DiagramStyle,
): void {
  const g = el('g', { class: 'local-axis' });
  const left = globalSolverToDiagram(localToGlobalSolver(wheel, { x: -radius, y: 0 }, dAB));
  const right = globalSolverToDiagram(localToGlobalSolver(wheel, { x: radius, y: 0 }, dAB));
  g.appendChild(
    el('line', {
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y,
      stroke: '#7a8699',
      'stroke-width': style.gridStroke * 1.8,
      'stroke-dasharray': `${style.gridStroke * 5} ${style.gridStroke * 3}`,
    }),
  );
  svg.appendChild(g);
}

/** Mark where the line of action crosses wheel A's local y-axis (0, b_A). */
function drawInterceptMarker(svg: SVGSVGElement, bA: number, style: DiagramStyle): void {
  const p = globalSolverToDiagram({ x: 0, y: bA });
  const g = el('g', { class: 'intercept-marker' });
  g.appendChild(
    el('circle', {
      cx: p.x,
      cy: p.y,
      r: style.pointRadius * 0.7,
      fill: 'none',
      stroke: '#7a8699',
      'stroke-width': style.gridStroke * 2,
    }),
  );
  const text = el('text', {
    x: p.x + style.labelOffset * 0.6,
    y: p.y,
    class: 'point-label',
    'font-size': style.fontSize * 0.85,
    fill: '#666',
  });
  text.textContent = `b_A`;
  g.appendChild(text);
  svg.appendChild(g);
}

export class Diagram {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private callbacks: DiagramCallbacks;
  private view: ViewTransform = { minX: -1, minY: -1, width: 2, height: 2 };
  private coordMode = false;
  private dAB = 1;

  constructor(container: HTMLElement, callbacks: DiagramCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.svg = el('svg', { class: 'diagram-svg', role: 'img', 'aria-label': 'Wheel diagram' });
    this.container.replaceChildren(this.svg);
    this.svg.addEventListener('click', (e) => this.handleClick(e));
  }

  setCoordMode(enabled: boolean): void {
    this.coordMode = enabled;
    this.svg.classList.toggle('coord-mode', enabled);
  }

  private clientToSvg(clientX: number, clientY: number): Point2 {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  private handleClick(e: MouseEvent): void {
    if (!this.coordMode || !this.callbacks.onWheelClick) return;
    const svgPt = this.clientToSvg(e.clientX, e.clientY);

    const localA = svgToLocalWheel(svgPt, 'A', this.dAB);
    const localB = svgToLocalWheel(svgPt, 'B', this.dAB);
    const distA = Math.hypot(localA.x, localA.y);
    const distB = Math.hypot(localB.x, localB.y);

    // Pick nearest wheel if click is inside either disk.
    const rA = this.rA;
    const rB = this.rB;
    let wheel: WheelId | null = null;
    let local: Point2 | null = null;

    const inA = distA <= rA;
    const inB = distB <= rB;
    if (inA && inB) {
      wheel = distA <= distB ? 'A' : 'B';
      local = wheel === 'A' ? localA : localB;
    } else if (inA) {
      wheel = 'A';
      local = localA;
    } else if (inB) {
      wheel = 'B';
      local = localB;
    }

    if (wheel && local) {
      const radius = wheel === 'A' ? rA : rB;
      const constrained = constrainToWheel(local, radius);
      this.callbacks.onWheelClick(wheel, solverLocalToUser(constrained));
    }
  }

  private rA = 0.4;
  private rB = 0.4;

  render(state: InputState, result: SolveResult): void {
    this.dAB = state.dAB;
    this.rA = state.rA;
    this.rB = state.rB;
    this.view = computeViewTransform(state, result);
    const view = this.view;
    const style = diagramStyle(state);

    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `${view.minX} ${view.minY} ${view.width} ${view.height}`);

    drawGrid(this.svg, view, style);
    drawWheel(this.svg, 'A', state.rA, state.dAB, 'O_A', style);
    drawWheel(this.svg, 'B', state.rB, state.dAB, 'O_B', style);
    drawLocalXAxis(this.svg, 'A', state.rA, state.dAB, style);
    drawLocalXAxis(this.svg, 'B', state.rB, state.dAB, style);

    if (hasPhysicsOutput(result) && !result.isVertical && result.bA !== undefined) {
      drawInterceptMarker(this.svg, result.bA, style);
    }

    if (result.kind === 'infinite-slopes') {
      const other = result.otherWheel;
      const radius = other === 'A' ? state.rA : state.rB;
      drawHighlightRegion(this.svg, other, radius, state.dAB, style);
    }

    const extent = Math.max(state.dAB, state.rA, state.rB) * 2;
    const linePts = linePhysicsPoints(result, state.dAB, extent);

    if (linePts) {
      const [g1, g2] = linePts;
      const s1 = globalSolverToDiagram(g1);
      const s2 = globalSolverToDiagram(g2);
      const stroke = hasPhysicsOutput(result)
        ? physicsAccentColor(result)
        : result.kind === 'no-solution' || result.kind === 'zero-torques'
          ? '#999'
          : '#bbb';
      this.svg.appendChild(
        el('line', {
          x1: s1.x,
          y1: s1.y,
          x2: s2.x,
          y2: s2.y,
          stroke,
          'stroke-width': style.lineStroke,
          'stroke-dasharray':
            hasPhysicsOutput(result) ? undefined : `${style.lineStroke * 3} ${style.lineStroke * 2}`,
        }),
      );
    }

    if (hasPhysicsOutput(result)) {
      const pointFill = physicsAccentColor(result);
      const pAUser = solverLocalToUser(result.pA);
      const pBUser = solverLocalToUser(result.pB);
      drawPoint(
        this.svg,
        result.pA,
        'A',
        state.dAB,
        `A: (${formatPt(pAUser.x)}, ${formatPt(pAUser.y)})`,
        pointFill,
        style,
      );
      drawPoint(
        this.svg,
        result.pB,
        'B',
        state.dAB,
        `B: (${formatPt(pBUser.x)}, ${formatPt(pBUser.y)})`,
        pointFill,
        style,
      );
    }

    if (state.mode === 'coord') {
      const pickSolver = userLocalToSolver({ x: state.coordX, y: state.coordY });
      drawPoint(
        this.svg,
        pickSolver,
        state.coordWheel,
        state.dAB,
        `pick: (${formatPt(state.coordX)}, ${formatPt(state.coordY)})`,
        '#2980b9',
        style,
      );
      if (
        state.secondCoordWheel !== undefined &&
        state.secondCoordX !== undefined &&
        state.secondCoordY !== undefined
      ) {
        const pick2Solver = userLocalToSolver({
          x: state.secondCoordX,
          y: state.secondCoordY,
        });
        drawPoint(
          this.svg,
          pick2Solver,
          state.secondCoordWheel,
          state.dAB,
          `pick2: (${formatPt(state.secondCoordX)}, ${formatPt(state.secondCoordY)})`,
          '#2980b9',
          style,
        );
      }
    }
  }
}

function formatPt(v: number): string {
  const rounded = Math.round(v * 1000) / 1000;
  return String(rounded);
}
