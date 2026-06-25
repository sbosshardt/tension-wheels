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
  /** Line-of-action angle from wheel A, physics convention (0° = +x, 90° = +y). */
  thetaDeg: number;
  coordWheel: WheelId;
  coordX: number;
  coordY: number;
  /** Vertical line offset x = c when S = 0 (angle mode). */
  verticalOffsetC: number;
  /** Second pick on the other wheel when resolving infinite-slope family. */
  secondCoordWheel?: WheelId;
  secondCoordX?: number;
  secondCoordY?: number;
}

export interface ValidSolution {
  kind: 'valid';
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

export type SolveResult =
  | ValidSolution
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
