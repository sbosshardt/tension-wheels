export type SolveMode = 'angle' | 'coord';
export type WheelId = 'A' | 'B';

export interface Point2 {
  x: number;
  y: number;
}

export interface Force2 {
  x: number;
  y: number;
}

export interface InputState {
  dAB: number;
  rA: number;
  rB: number;
  tauA: number;
  tauB: number;
  mode: SolveMode;
  /** Line-of-action angle from wheel A (0° = +x, 90° = +y up). */
  thetaDeg: number;
  coordWheel: WheelId;
  /** Wheel-local x (m), y up. */
  coordX: number;
  coordY: number;
  /** Vertical line offset x = c when S = 0 (angle mode). */
  verticalOffsetC: number;
  /** Second pick on the other wheel when resolving infinite-slope family. */
  secondCoordWheel?: WheelId;
  secondCoordX?: number;
  secondCoordY?: number;
}

export interface PhysicsSolution {
  S: number;
  isVertical: boolean;
  m?: number;
  bA?: number;
  bB?: number;
  verticalC?: number;
  thetaADeg: number;
  thetaBDeg: number;
  tension: number;
  fA: Force2;
  fB: Force2;
  pA: Point2;
  pB: Point2;
  lA: number;
  lB: number;
  radiusValidA: boolean;
  radiusValidB: boolean;
  overlapWarning: boolean;
}

export interface ValidSolution extends PhysicsSolution {
  kind: 'valid';
}

export interface PushOnlySolution extends PhysicsSolution {
  kind: 'push-only';
}

export type SolveResult =
  | ValidSolution
  | PushOnlySolution
  | { kind: 'no-solution'; reason: string; overlapWarning: boolean }
  | {
      kind: 'infinite-slopes';
      wheel: WheelId;
      otherWheel: WheelId;
      bA: number;
      bB: number;
      overlapWarning: boolean;
    }
  | { kind: 'zero-torques'; overlapWarning: boolean }
  | { kind: 'needs-offset'; overlapWarning: boolean };

/** Result includes line geometry, attachment points, and force output. */
export function hasPhysicsOutput(result: SolveResult): result is ValidSolution | PushOnlySolution {
  return result.kind === 'valid' || result.kind === 'push-only';
}

export const DEFAULT_INPUT: InputState = {
  dAB: 1,
  rA: 0.4,
  rB: 0.4,
  tauA: 1,
  tauB: 1,
  mode: 'angle',
  thetaDeg: 45,
  coordWheel: 'A',
  coordX: 0.2,
  coordY: 0.2,
  verticalOffsetC: 0.2,
};
