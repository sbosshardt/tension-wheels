import type { Point2, WheelId } from './types';

/**
 * Map physics global coordinates to diagram display.
 * Diagram uses y-down screen axes with wheel A above wheel B.
 */
export function physicsToDiagram(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

/** Inverse of physicsToDiagram for click picking. */
export function diagramToPhysicsGlobal(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

/** Wheel B global origin in physics coordinates. */
export function wheelBOriginPhysics(dAB: number): Point2 {
  return { x: 0, y: dAB };
}

/** Local wheel coordinates → global physics coordinates. */
export function localToGlobalPhysics(wheel: WheelId, local: Point2, dAB: number): Point2 {
  if (wheel === 'A') {
    return { x: local.x, y: local.y };
  }
  const o = wheelBOriginPhysics(dAB);
  return { x: local.x + o.x, y: local.y + o.y };
}

/** Global physics coordinates → local wheel coordinates. */
export function globalToLocalPhysics(wheel: WheelId, global: Point2, dAB: number): Point2 {
  if (wheel === 'A') {
    return { x: global.x, y: global.y };
  }
  const o = wheelBOriginPhysics(dAB);
  return { x: global.x - o.x, y: global.y - o.y };
}

/** Constrain a point to lie on or inside a wheel disk; snap to rim if outside. */
export function constrainToWheel(local: Point2, radius: number): Point2 {
  const r2 = local.x * local.x + local.y * local.y;
  if (r2 <= radius * radius) {
    return local;
  }
  const r = Math.sqrt(r2);
  return { x: (local.x / r) * radius, y: (local.y / r) * radius };
}
