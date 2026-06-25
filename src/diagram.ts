import {
  constrainToWheel,
  localToGlobalPhysics,
  physicsToSvg,
  wheelBOriginPhysics,
} from './coords';
import type { InputState, Point2, SolveResult, WheelId } from './types';

export interface DiagramCallbacks {
  onWheelClick?: (wheel: WheelId, local: Point2) => void;
}

interface ViewTransform {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function computeViewTransform(state: InputState, result: SolveResult): ViewTransform {
  const dAB = state.dAB;
  const rMax = Math.max(state.rA, state.rB, 0.1);
  const points: Point2[] = [
    { x: -state.rA, y: -state.rA },
    { x: state.rA, y: state.rA },
    localToGlobalPhysics('B', { x: -state.rB, y: -state.rB }, dAB),
    localToGlobalPhysics('B', { x: state.rB, y: state.rB }, dAB),
    wheelBOriginPhysics(dAB),
    { x: 0, y: 0 },
  ];

  if (result.kind === 'valid') {
    points.push(
      localToGlobalPhysics('A', result.pA, dAB),
      localToGlobalPhysics('B', result.pB, dAB),
    );
  }

  if (state.mode === 'coord') {
    points.push(localToGlobalPhysics(state.coordWheel, { x: state.coordX, y: state.coordY }, dAB));
    if (state.secondCoordWheel !== undefined && state.secondCoordX !== undefined && state.secondCoordY !== undefined) {
      points.push(
        localToGlobalPhysics(
          state.secondCoordWheel,
          { x: state.secondCoordX, y: state.secondCoordY },
          dAB,
        ),
      );
    }
  }

  const svgPoints = points.map(physicsToSvg);
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

function globalPhysicsToSvg(global: Point2): Point2 {
  return physicsToSvg(global);
}

function svgToGlobalPhysics(svg: Point2): Point2 {
  return { x: svg.x, y: -svg.y };
}

function svgToLocalWheel(svg: Point2, wheel: WheelId, dAB: number): Point2 {
  const global = svgToGlobalPhysics(svg);
  if (wheel === 'A') return global;
  const o = wheelBOriginPhysics(dAB);
  return { x: global.x - o.x, y: global.y - o.y };
}

function linePhysicsPoints(
  result: SolveResult,
  dAB: number,
  extent: number,
): [Point2, Point2] | null {
  if (result.kind !== 'valid') return null;

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
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

function drawGrid(svg: SVGSVGElement, view: ViewTransform): void {
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
): void {
  const origin = wheel === 'A' ? { x: 0, y: 0 } : wheelBOriginPhysics(dAB);
  const center = globalPhysicsToSvg(origin);
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
): void {
  const origin = wheel === 'A' ? { x: 0, y: 0 } : wheelBOriginPhysics(dAB);
  const center = globalPhysicsToSvg(origin);
  const g = el('g', { class: `wheel wheel-${wheel.toLowerCase()}` });
  g.appendChild(el('circle', { cx: center.x, cy: center.y, r: radius }));
  g.appendChild(el('circle', { cx: center.x, cy: center.y, r: 3, class: 'axle' }));
  const text = el('text', { x: center.x - radius * 0.2, y: center.y + radius * 0.35, class: 'origin-label' });
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
  className: string,
): void {
  const global = localToGlobalPhysics(wheel, local, dAB);
  const p = globalPhysicsToSvg(global);
  const g = el('g', { class: className });
  g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 5 }));
  const text = el('text', { x: p.x + 8, y: p.y - 8, class: 'point-label' });
  text.textContent = label;
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
      this.callbacks.onWheelClick(wheel, constrained);
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

    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `${view.minX} ${view.minY} ${view.width} ${view.height}`);

    drawGrid(this.svg, view);
    drawWheel(this.svg, 'A', state.rA, state.dAB, 'O_A');
    drawWheel(this.svg, 'B', state.rB, state.dAB, 'O_B');

    if (result.kind === 'infinite-slopes') {
      const other = result.otherWheel;
      const radius = other === 'A' ? state.rA : state.rB;
      drawHighlightRegion(this.svg, other, radius, state.dAB);
    }

    const extent = Math.max(state.dAB, state.rA, state.rB) * 2;
    const linePts = linePhysicsPoints(result, state.dAB, extent);
    const lineClass =
      result.kind === 'valid'
        ? 'line-of-action'
        : result.kind === 'no-solution' || result.kind === 'zero-torques'
          ? 'line-of-action error'
          : 'line-of-action muted';

    if (linePts) {
      const [g1, g2] = linePts;
      const s1 = globalPhysicsToSvg(g1);
      const s2 = globalPhysicsToSvg(g2);
      this.svg.appendChild(
        el('line', {
          x1: s1.x,
          y1: s1.y,
          x2: s2.x,
          y2: s2.y,
          class: lineClass,
        }),
      );
    }

    if (result.kind === 'valid') {
      drawPoint(
        this.svg,
        result.pA,
        'A',
        state.dAB,
        `A: (${formatPt(result.pA.x)}, ${formatPt(result.pA.y)})`,
        'attachment-point',
      );
      drawPoint(
        this.svg,
        result.pB,
        'B',
        state.dAB,
        `B: (${formatPt(result.pB.x)}, ${formatPt(result.pB.y)})`,
        'attachment-point',
      );
    }

    if (state.mode === 'coord') {
      drawPoint(
        this.svg,
        { x: state.coordX, y: state.coordY },
        state.coordWheel,
        state.dAB,
        `pick: (${formatPt(state.coordX)}, ${formatPt(state.coordY)})`,
        'coord-pick',
      );
      if (
        state.secondCoordWheel !== undefined &&
        state.secondCoordX !== undefined &&
        state.secondCoordY !== undefined
      ) {
        drawPoint(
          this.svg,
          { x: state.secondCoordX, y: state.secondCoordY },
          state.secondCoordWheel,
          state.dAB,
          `pick2: (${formatPt(state.secondCoordX)}, ${formatPt(state.secondCoordY)})`,
          'coord-pick',
        );
      }
    }
  }
}

function formatPt(v: number): string {
  const rounded = Math.round(v * 1000) / 1000;
  return String(rounded);
}
