import { localToGlobalSolver, solverLocalToUser, userLocalToSolver } from './coords';
import type { InputState, Point2, SolveResult, WheelId } from './types';

export const EPS = 1e-9;
export const VERTICAL_ANGLE_TOL_DEG = 0.1;
export const MAX_FINITE_SLOPE = 1e6;

export const NO_VERTICAL_FINITE_SLOPE_REASON =
  'When τ_A + τ_B ≠ 0, the line of action cannot be vertical. θ = 90° and θ = 270° are not valid because the finite slope is undefined. Use equal and opposite torques for a vertical line, or choose another angle.';

export const NO_TENSION_ONLY_REASON =
  'No tension-only solution: this line of action would require the rubber band to push on a wheel. A rubber band can only pull — try a different angle or torque combination.';

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

/**
 * Intercepts for finite-slope family (S ≠ 0).
 * b_A uses |S| so opposite torque signs select opposite line branches.
 * b_B = b_A − d_AB enforces one global line: y_A = m·x + b_A in A frame matches
 * y_B = m·x + b_B in B frame (B origin at y = d_AB in solver global).
 */
export function computeIntercepts(dAB: number, tauA: number, _tauB: number, S: number): {
  bA: number;
  bB: number;
} {
  const absS = Math.abs(S);
  const bA = (dAB * tauA) / absS;
  return {
    bA,
    bB: bA - dAB,
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

/** Torque about wheel origin from force at a foot point (user y↑ local). */
export function torqueFromForceAt(pSolver: Point2, fUser: { x: number; y: number }): number {
  const p = solverLocalToUser(pSolver);
  return p.x * fUser.y - p.y * fUser.x;
}

function torquesExactMatch(tauFromBand: number, tauApplied: number): boolean {
  const tol = EPS * Math.max(1, Math.abs(tauApplied));
  return Math.abs(tauFromBand - tauApplied) <= tol;
}

function torquesOppositeMatch(tauFromBand: number, tauApplied: number): boolean {
  const tol = EPS * Math.max(1, Math.abs(tauApplied));
  return Math.abs(tauFromBand + tauApplied) <= tol;
}

function torquesMatchApplied(
  tauFromBand: number,
  tauApplied: number,
  S: number,
): boolean {
  if (torquesExactMatch(tauFromBand, tauApplied)) return true;
  // Opposite line direction when S < 0 (legacy vertical / branch convention).
  if (S < 0 && torquesOppositeMatch(tauFromBand, tauApplied)) return true;
  return false;
}

/** True when forces push wheels apart vertically (compression), not tension. */
function isCompressive(fA: { x: number; y: number }, fB: { x: number; y: number }): boolean {
  return fA.y > EPS && fB.y < -EPS;
}

/** Forces along the line; both torques must match exactly. */
function selectForcesAlongLine(
  pA: Point2,
  pB: Point2,
  m: number,
  tension: number,
  state: InputState,
  requireCompressive: boolean,
): { fA: { x: number; y: number }; fB: { x: number; y: number } } | undefined {
  const len = Math.sqrt(1 + m * m);
  const unitLine = { x: 1 / len, y: m / len };
  const candidates: Array<{ fASolver: { x: number; y: number } }> = [
    { fASolver: { x: tension * unitLine.x, y: tension * unitLine.y } },
    { fASolver: { x: -tension * unitLine.x, y: -tension * unitLine.y } },
  ];

  for (const { fASolver } of candidates) {
    const fAUser = { x: fASolver.x, y: -fASolver.y };
    const fBSolver = { x: -fASolver.x, y: -fASolver.y };
    const fBUser = { x: fBSolver.x, y: -fBSolver.y };
    if (
      isCompressive(fAUser, fBUser) !== requireCompressive ||
      !torquesExactMatch(torqueFromForceAt(pA, fAUser), state.tauA) ||
      !torquesExactMatch(torqueFromForceAt(pB, fBUser), state.tauB)
    ) {
      continue;
    }
    return { fA: fAUser, fB: fBUser };
  }

  return undefined;
}

function buildFiniteSlopeSolution(
  state: InputState,
  m: number,
  bAIn: number,
  bBIn: number,
  thetaADeg: number,
  overlapWarning: boolean,
): SolveResult {
  const rejected = rejectNonFiniteSlope(m, thetaADeg, overlapWarning);
  if (rejected) return rejected;

  const S = sumTorques(state.tauA, state.tauB);
  const denom = 1 + m * m;
  const len = Math.sqrt(denom);
  const tension = (Math.abs(S) * len) / state.dAB;

  if (!Number.isFinite(tension) || tension > 1e12) {
    return {
      kind: 'no-solution',
      reason: NO_VERTICAL_FINITE_SLOPE_REASON,
      overlapWarning,
    };
  }

  const bA = bAIn;
  const bB = bBIn;
  const pA = perpendicularFoot(m, bA);
  const pB = perpendicularFoot(m, bB);
  const tensionForces = selectForcesAlongLine(pA, pB, m, tension, state, false);
  const pushForces = tensionForces ?? selectForcesAlongLine(pA, pB, m, tension, state, true);

  if (pushForces === undefined) {
    return {
      kind: 'no-solution',
      reason:
        'No solution: forces on this line of action cannot balance the applied torques.',
      overlapWarning,
    };
  }

  const solutionKind = tensionForces !== undefined ? 'valid' : 'push-only';
  const { fA, fB } = pushForces;
  const lA = leverArmLength(bA, m);
  const lB = leverArmLength(bB, m);

  const thetaPhysicsDeg = solverAngleToPhysicsDeg(thetaADeg);

  return {
    kind: solutionKind,
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
  const tension = Math.abs(state.tauA / c);
  const p = { x: c, y: 0 };
  const l = Math.abs(c);
  const pAGlobal = localToGlobalSolver('A', p, state.dAB);
  const pBGlobal = localToGlobalSolver('B', p, state.dAB);
  const towardB = pBGlobal.y - pAGlobal.y;
  const pullTowardB = towardB >= 0 ? 1 : -1;
  const fASolverPull = { x: 0, y: pullTowardB * tension };
  const fAPull = { x: 0, y: -fASolverPull.y };
  const fBPull = { x: 0, y: -fAPull.y };
  const tauAPull = torqueFromForceAt(p, fAPull);
  const tauBPull = torqueFromForceAt(p, fBPull);

  let fA = fAPull;
  let fB = fBPull;
  const pullMatches =
    torquesMatchApplied(tauAPull, state.tauA, S) &&
    torquesMatchApplied(tauBPull, state.tauB, S);

  if (!pullMatches) {
    const fASolverOpp = { x: 0, y: -pullTowardB * tension };
    const fAOpp = { x: 0, y: -fASolverOpp.y };
    const fBOpp = { x: 0, y: -fAOpp.y };
    const tauAOpp = torqueFromForceAt(p, fAOpp);
    const tauBOpp = torqueFromForceAt(p, fBOpp);
    if (
      torquesMatchApplied(tauAOpp, state.tauA, S) &&
      torquesMatchApplied(tauBOpp, state.tauB, S)
    ) {
      fA = fAOpp;
      fB = fBOpp;
    } else {
      return {
        kind: 'no-solution',
        reason: NO_TENSION_ONLY_REASON,
        overlapWarning,
      };
    }
  }

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
