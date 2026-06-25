import type { Point2, WheelId } from './types';

/**
 * Wheel-local / diagram coordinates used by the solver and SVG:
 * - x positive to the right
 * - y positive downward (wheel A: toward B; wheel B: same local orientation)
 * - θ measured from +x toward +y in this frame (90° points toward B on the diagram)
 *
 * For engineering reports that prefer y-up, use `toPhysicsYUpLocal`.
 */

/** Map global solver coordinates to SVG (same axes). */
export function solverToDiagram(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

export function diagramToSolver(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

/** Convert wheel-local solver coords to y-up physics display (flip local y). */
export function toPhysicsYUpLocal(p: Point2): Point2 {
  return { x: p.x, y: -p.y };
}

/** Wheel B global origin in solver coordinates. */
export function wheelBOriginSolver(dAB: number): Point2 {
  return { x: 0, y: dAB };
}

/** Local wheel coordinates → global solver coordinates. */
export function localToGlobalSolver(wheel: WheelId, local: Point2, dAB: number): Point2 {
  if (wheel === 'A') {
    return { x: local.x, y: local.y };
  }
  const o = wheelBOriginSolver(dAB);
  return { x: local.x + o.x, y: local.y + o.y };
}

/** Global solver coordinates → local wheel coordinates. */
export function globalToLocalSolver(wheel: WheelId, global: Point2, dAB: number): Point2 {
  if (wheel === 'A') {
    return { x: global.x, y: global.y };
  }
  const o = wheelBOriginSolver(dAB);
  return { x: global.x - o.x, y: global.y - o.y };
}

/** @deprecated Use solverToDiagram */
export const physicsToDiagram = solverToDiagram;
/** @deprecated Use diagramToSolver */
export const diagramToPhysicsGlobal = diagramToSolver;
/** @deprecated Use localToGlobalSolver */
export const localToGlobalPhysics = localToGlobalSolver;
/** @deprecated Use globalToLocalSolver */
export const globalToLocalPhysics = globalToLocalSolver;
/** @deprecated Use wheelBOriginSolver */
export const wheelBOriginPhysics = wheelBOriginSolver;

/** Constrain a point to lie on or inside a wheel disk; snap to rim if outside. */
export function constrainToWheel(local: Point2, radius: number): Point2 {
  const r2 = local.x * local.x + local.y * local.y;
  if (r2 <= radius * radius) {
    return local;
  }
  const r = Math.sqrt(r2);
  return { x: (local.x / r) * radius, y: (local.y / r) * radius };
}
