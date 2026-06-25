import { userLocalToSolver } from './coords';
import type { InputState, Point2, SolveResult, WheelId } from './types';

export const EPS = 1e-9;
export const VERTICAL_ANGLE_TOL_DEG = 0.1;
export const MAX_FINITE_SLOPE = 1e6;

export const NO_VERTICAL_FINITE_SLOPE_REASON =
  'When τ_A + τ_B ≠ 0, the line of action cannot be vertical. θ = 90° and θ = 270° are not valid because the finite slope is undefined. Use equal and opposite torques for a vertical line, or choose another angle.';

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function normalizeAngle0to360(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

export function slopeFromAngleDeg(thetaDeg: number): number {
  return Math.tan(degToRad(thetaDeg));
}

export function isNearVerticalAngle(thetaDeg: number): boolean {
  const a = normalizeAngle0to360(thetaDeg);
  const dist = Math.min(Math.abs(a - 90), Math.abs(a - 270));
  return dist < VERTICAL_ANGLE_TOL_DEG;
}

/** Finite slope m for angle mode, or null when vertical / undefined. */
/** User-facing angle (y↑) → internal solver angle (y↓). */
export function physicsAngleToSolverDeg(thetaPhysicsDeg: number): number {
  return normalizeAngle0to360(-thetaPhysicsDeg);
}

/** Internal solver angle (y↓) → user-facing angle (y↑). */
export function solverAngleToPhysicsDeg(thetaSolverDeg: number): number {
  return normalizeAngle0to360(-thetaSolverDeg);
}

export function slopeForAngle(thetaSolverDeg: number): number | null {
  if (isNearVerticalAngle(thetaSolverDeg)) return null;
  const m = slopeFromAngleDeg(thetaSolverDeg);
  if (!Number.isFinite(m) || Math.abs(m) > MAX_FINITE_SLOPE) return null;
  return m;
}

/** Slope in internal solver frame from user-facing angle (y↑). */
export function solverSlopeFromPhysicsAngle(thetaPhysicsDeg: number): number | null {
  return slopeForAngle(physicsAngleToSolverDeg(thetaPhysicsDeg));
}

function rejectNonFiniteSlope(
  m: number,
  thetaDeg: number,
  overlapWarning: boolean,
): SolveResult | null {
  if (isNearVerticalAngle(thetaDeg) || !Number.isFinite(m) || Math.abs(m) > MAX_FINITE_SLOPE) {
    return { kind: 'no-solution', reason: NO_VERTICAL_FINITE_SLOPE_REASON, overlapWarning };
  }
  return null;
}

export function angleFromSlopeDeg(m: number): number {
  return normalizeAngle0to360(radToDeg(Math.atan(m)));
}

export function linkedAngleBDeg(thetaADeg: number): number {
  return normalizeAngle0to360(thetaADeg + 180);
}

export function sumTorques(tauA: number, tauB: number): number {
  return tauA + tauB;
}

export function hasOverlap(rA: number, rB: number, dAB: number): boolean {
  return rA + rB >= dAB - EPS;
}

type SlopePickResult =
  | { kind: 'unique'; m: number }
  | { kind: 'infinite-slopes' }
  | { kind: 'no-solution'; reason: string };

/** Intercepts for finite-slope family (S ≠ 0). */
export function computeIntercepts(dAB: number, tauA: number, tauB: number, S: number): {
  bA: number;
  bB: number;
} {
  return {
    bA: (dAB * tauA) / S,
    bB: (-dAB * tauB) / S,
  };
}

export function slopeFromCoordinatePick(
  wheel: WheelId,
  x: number,
  y: number,
  bA: number,
  bB: number,
): SlopePickResult {
  const b = wheel === 'A' ? bA : bB;
  if (Math.abs(x) > EPS) {
    return { kind: 'unique', m: (y - b) / x };
  }
  if (Math.abs(y - b) < EPS) {
    return { kind: 'infinite-slopes' };
  }
  return {
    kind: 'no-solution',
    reason: `The selected point on wheel ${wheel} lies on the local y-axis and does not match the required intercept.`,
  };
}

/** Perpendicular foot from origin to line y = m*x + b. */
export function perpendicularFoot(m: number, b: number): Point2 {
  const denom = 1 + m * m;
  return { x: (-m * b) / denom, y: b / denom };
}

export function leverArmLength(b: number, m: number): number {
  return Math.abs(b) / Math.sqrt(1 + m * m);
}

function buildFiniteSlopeSolution(
  state: InputState,
  m: number,
  bA: number,
  bB: number,
  thetaADeg: number,
  overlapWarning: boolean,
): SolveResult {
  const rejected = rejectNonFiniteSlope(m, thetaADeg, overlapWarning);
  if (rejected) return rejected;

  const S = sumTorques(state.tauA, state.tauB);
  const denom = 1 + m * m;
  const pA = perpendicularFoot(m, bA);
  const pB = perpendicularFoot(m, bB);
  const lA = leverArmLength(bA, m);
  const lB = leverArmLength(bB, m);
  const tension = (Math.abs(S) * Math.sqrt(denom)) / state.dAB;

  if (!Number.isFinite(tension) || tension > 1e12) {
    return {
      kind: 'no-solution',
      reason: NO_VERTICAL_FINITE_SLOPE_REASON,
      overlapWarning,
    };
  }

  const scale = S / state.dAB;
  const fA = { x: scale, y: -(scale * m) };
  const fB = { x: -fA.x, y: -fA.y };

  const thetaPhysicsDeg = solverAngleToPhysicsDeg(thetaADeg);

  return {
    kind: 'valid',
    S,
    isVertical: false,
    m,
    bA,
    bB,
    thetaADeg: thetaPhysicsDeg,
    thetaBDeg: linkedAngleBDeg(thetaPhysicsDeg),
    tension,
    fA,
    fB,
    pA,
    pB,
    lA,
    lB,
    radiusValidA: lA <= state.rA + EPS,
    radiusValidB: lB <= state.rB + EPS,
    overlapWarning,
  };
}

function buildVerticalSolution(state: InputState, c: number, overlapWarning: boolean): SolveResult {
  if (Math.abs(c) < EPS) {
    return {
      kind: 'no-solution',
      reason:
        'No solution for nonzero torques: the vertical line passes through the axle (c = 0) and has zero moment arm.',
      overlapWarning,
    };
  }

  const S = sumTorques(state.tauA, state.tauB);
  const fAy = state.tauA / c;
  const fA = { x: 0, y: fAy };
  const fB = { x: 0, y: -fAy };
  // Forces are in user y↑ frame; x is unchanged for vertical lines.
  const tension = Math.abs(fAy);
  const p = { x: c, y: 0 };
  const l = Math.abs(c);

  return {
    kind: 'valid',
    S,
    isVertical: true,
    verticalC: c,
    thetaADeg: 90,
    thetaBDeg: 270,
    tension,
    fA,
    fB,
    pA: p,
    pB: p,
    lA: l,
    lB: l,
    radiusValidA: l <= state.rA + EPS,
    radiusValidB: l <= state.rB + EPS,
    overlapWarning,
  };
}

function solveVertical(state: InputState, overlapWarning: boolean): SolveResult {
  let c: number | undefined;

  if (state.mode === 'coord') {
    if (Math.abs(state.coordX) < EPS) {
      return {
        kind: 'no-solution',
        reason:
          'No solution for nonzero torques: a vertical line requires a nonzero x-offset (x ≠ 0 on the selected wheel).',
        overlapWarning,
      };
    }
    c = state.coordX;
  } else if (Math.abs(state.verticalOffsetC) > EPS) {
    c = state.verticalOffsetC;
  } else {
    return { kind: 'needs-offset', overlapWarning };
  }

  return buildVerticalSolution(state, c, overlapWarning);
}

function solveFiniteSlopeAngle(state: InputState, overlapWarning: boolean): SolveResult {
  const S = sumTorques(state.tauA, state.tauB);
  const thetaSolverDeg = physicsAngleToSolverDeg(state.thetaDeg);
  const m = slopeForAngle(thetaSolverDeg);
  if (m === null) {
    return { kind: 'no-solution', reason: NO_VERTICAL_FINITE_SLOPE_REASON, overlapWarning };
  }
  const { bA, bB } = computeIntercepts(state.dAB, state.tauA, state.tauB, S);
  return buildFiniteSlopeSolution(state, m, bA, bB, thetaSolverDeg, overlapWarning);
}

function solveFiniteSlopeCoord(state: InputState, overlapWarning: boolean): SolveResult {
  const S = sumTorques(state.tauA, state.tauB);
  const { bA, bB } = computeIntercepts(state.dAB, state.tauA, state.tauB, S);
  const primaryWheel = state.coordWheel;
  const primaryPick = userLocalToSolver({ x: state.coordX, y: state.coordY });
  const primary = slopeFromCoordinatePick(
    primaryWheel,
    primaryPick.x,
    primaryPick.y,
    bA,
    bB,
  );

  if (primary.kind === 'unique') {
    const theta = angleFromSlopeDeg(primary.m);
    return buildFiniteSlopeSolution(state, primary.m, bA, bB, theta, overlapWarning);
  }

  if (primary.kind === 'no-solution') {
    return { kind: 'no-solution', reason: primary.reason, overlapWarning };
  }

  // Infinite slopes: need a second pick on the other wheel.
  const otherWheel: WheelId = primaryWheel === 'A' ? 'B' : 'A';
  if (
    state.secondCoordWheel === otherWheel &&
    state.secondCoordX !== undefined &&
    state.secondCoordY !== undefined
  ) {
    const secondaryPick = userLocalToSolver({
      x: state.secondCoordX,
      y: state.secondCoordY,
    });
    const secondary = slopeFromCoordinatePick(
      otherWheel,
      secondaryPick.x,
      secondaryPick.y,
      bA,
      bB,
    );
    if (secondary.kind === 'unique') {
      const theta = angleFromSlopeDeg(secondary.m);
      return buildFiniteSlopeSolution(state, secondary.m, bA, bB, theta, overlapWarning);
    }
    if (secondary.kind === 'no-solution') {
      return { kind: 'no-solution', reason: secondary.reason, overlapWarning };
    }
    return {
      kind: 'infinite-slopes',
      wheel: primaryWheel,
      otherWheel,
      bA,
      bB,
      overlapWarning,
    };
  }

  return {
    kind: 'infinite-slopes',
    wheel: primaryWheel,
    otherWheel,
    bA,
    bB,
    overlapWarning,
  };
}

/** Main solver: inputs use user y↑ local coords; internal math uses y↓ solver frame. */
export function solve(state: InputState): SolveResult {
  const overlapWarning = hasOverlap(state.rA, state.rB, state.dAB);

  if (Math.abs(state.tauA) < EPS && Math.abs(state.tauB) < EPS) {
    return { kind: 'zero-torques', overlapWarning };
  }

  const S = sumTorques(state.tauA, state.tauB);

  if (Math.abs(S) < EPS) {
    return solveVertical(state, overlapWarning);
  }

  if (state.mode === 'angle') {
    return solveFiniteSlopeAngle(state, overlapWarning);
  }

  return solveFiniteSlopeCoord(state, overlapWarning);
}
