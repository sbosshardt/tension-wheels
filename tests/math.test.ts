import { describe, expect, it } from 'vitest';
import {
  computeIntercepts,
  slopeFromCoordinatePick,
  solve,
  sumTorques,
} from '../src/math';
import { solverLocalToUser } from '../src/coords';
import { DEFAULT_INPUT, type InputState } from '../src/types';

function base(overrides: Partial<InputState> = {}): InputState {
  return { ...DEFAULT_INPUT, ...overrides };
}

describe('Example 1: default Case 1 at 45°', () => {
  const state = base({ thetaDeg: 45 });
  const result = solve(state);

  it('classifies as valid finite slope', () => {
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.isVertical).toBe(false);
    expect(result.S).toBeCloseTo(2);
    expect(result.m).toBeCloseTo(-1);
    expect(result.bA).toBeCloseTo(0.5);
    expect(result.bB).toBeCloseTo(-0.5);
    expect(result.thetaADeg).toBeCloseTo(45);
    expect(result.tension).toBeCloseTo(2.828, 3);
    expect(result.pA.x).toBeCloseTo(0.25);
    expect(result.pA.y).toBeCloseTo(0.25);
    expect(result.pB.x).toBeCloseTo(-0.25);
    expect(result.pB.y).toBeCloseTo(-0.25);
    expect(result.lA).toBeCloseTo(0.354, 3);
    expect(result.lB).toBeCloseTo(0.354, 3);
    expect(result.fA.x).toBeCloseTo(2);
    expect(result.fA.y).toBeCloseTo(2);
    expect(result.fB.x).toBeCloseTo(-2);
    expect(result.fB.y).toBeCloseTo(-2);
    expect(result.radiusValidA).toBe(true);
    expect(result.radiusValidB).toBe(true);
  });
});

describe('Example 2: horizontal line at 0°', () => {
  const state = base({ thetaDeg: 0 });
  const result = solve(state);

  it('has m=0 and lever arms 0.5 but fails radius check', () => {
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.m).toBeCloseTo(0);
    expect(result.lA).toBeCloseTo(0.5);
    expect(result.lB).toBeCloseTo(0.5);
    expect(result.radiusValidA).toBe(false);
    expect(result.radiusValidB).toBe(false);
  });
});

describe('Example 3: equal-and-opposite vertical case', () => {
  const state = base({
    tauA: 1,
    tauB: -1,
    mode: 'angle',
    verticalOffsetC: 0.2,
  });
  const result = solve(state);

  it('produces vertical solution at c=0.2', () => {
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.isVertical).toBe(true);
    expect(sumTorques(state.tauA, state.tauB)).toBeCloseTo(0);
    expect(result.verticalC).toBeCloseTo(0.2);
    expect(result.tension).toBeCloseTo(5);
    expect(result.pA.x).toBeCloseTo(0.2);
    expect(result.pA.y).toBeCloseTo(0);
    expect(result.fA.x).toBeCloseTo(0);
    expect(result.fA.y).toBeCloseTo(5);
    expect(result.fB.x).toBeCloseTo(0);
    expect(result.fB.y).toBeCloseTo(-5);
  });
});

describe('Example 4: zero torques', () => {
  const result = solve(base({ tauA: 0, tauB: 0 }));

  it('returns zero-torques status', () => {
    expect(result.kind).toBe('zero-torques');
  });
});

describe('Coordinate mode', () => {
  it('finds unique slope from wheel A pick', () => {
    const state = base({
      mode: 'coord',
      coordWheel: 'A',
      coordX: 0.5,
      coordY: -1,
    });
    const result = solve(state);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    const { bA } = computeIntercepts(state.dAB, state.tauA, state.tauB, 2);
    expect(result.m).toBeCloseTo((1 - bA) / 0.5);
  });

  it('detects infinite slopes at x=0 on intercept', () => {
    const { bA } = computeIntercepts(1, 1, 1, 2);
    const pick = slopeFromCoordinatePick('A', 0, bA, bA, -0.5);
    expect(pick.kind).toBe('infinite-slopes');

    const state = base({ mode: 'coord', coordWheel: 'A', coordX: 0, coordY: -bA });
    expect(solve(state).kind).toBe('infinite-slopes');
  });

  it('detects no solution at x=0 off intercept', () => {
    const state = base({ mode: 'coord', coordWheel: 'A', coordX: 0, coordY: -0.3 });
    expect(solve(state).kind).toBe('no-solution');
  });

  it('resolves infinite slopes with second pick on B', () => {
    const state = base({
      mode: 'coord',
      coordWheel: 'A',
      coordX: 0,
      coordY: -0.5,
      secondCoordWheel: 'B',
      secondCoordX: 0.25,
      secondCoordY: 0.25,
    });
    const result = solve(state);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.m).toBeCloseTo(1);
    expect(result.thetaADeg).toBeCloseTo(315, 0);
  });
});

describe('User regression: coord pick pulling right and down', () => {
  const state = base({
    rB: 0.2,
    tauA: 2,
    tauB: -1,
    mode: 'coord',
    coordWheel: 'A',
    coordX: -0.2,
    coordY: 0,
  });
  const result = solve(state);

  it('has correct lever-arm point and force components in y↑ frame', () => {
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.m).toBeCloseTo(10);
    const pAUser = solverLocalToUser(result.pA);
    expect(pAUser.x).toBeCloseTo(-0.198, 2);
    expect(pAUser.y).toBeCloseTo(-0.02, 2);
    expect(result.fA.x).toBeCloseTo(1);
    expect(result.fA.y).toBeCloseTo(-10);
  });
});

describe('Vertical angles with S ≠ 0', () => {
  it('rejects θ = 90°', () => {
    const result = solve(base({ thetaDeg: 90 }));
    expect(result.kind).toBe('no-solution');
    if (result.kind === 'no-solution') {
      expect(result.reason).toMatch(/vertical/i);
    }
  });

  it('rejects θ = 270°', () => {
    const result = solve(base({ thetaDeg: 270 }));
    expect(result.kind).toBe('no-solution');
  });

  it('still accepts θ = 89° with finite tension', () => {
    const result = solve(base({ thetaDeg: 89 }));
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') {
      expect(Number.isFinite(result.tension)).toBe(true);
      expect(result.tension).toBeLessThan(1e6);
    }
  });
});

describe('Vertical coordinate mode', () => {
  it('uses x as c when S=0', () => {
    const state = base({
      tauA: 1,
      tauB: -1,
      mode: 'coord',
      coordWheel: 'A',
      coordX: 0.2,
      coordY: 0.1,
    });
    const result = solve(state);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.tension).toBeCloseTo(5);
  });

  it('rejects x=0 for nonzero torque vertical case', () => {
    const state = base({
      tauA: 1,
      tauB: -1,
      mode: 'coord',
      coordWheel: 'A',
      coordX: 0,
      coordY: 0.1,
    });
    expect(solve(state).kind).toBe('no-solution');
  });
});
