import { describe, expect, it } from 'vitest';
import {
  computeIntercepts,
  slopeFromCoordinatePick,
  solve,
  sumTorques,
  torqueFromForceAt,
} from '../src/math';
import { solverLocalToUser } from '../src/coords';
import { DEFAULT_INPUT, hasPhysicsOutput, type InputState } from '../src/types';

function base(overrides: Partial<InputState> = {}): InputState {
  return { ...DEFAULT_INPUT, ...overrides };
}

describe('Example 1: default Case 1 at 45°', () => {
  const state = base({ thetaDeg: 45 });
  const result = solve(state);

  it('classifies as push-only (no rubber-band tension)', () => {
    expect(result.kind).toBe('push-only');
    if (result.kind !== 'push-only') return;
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
    expect(result.fA.x).toBeCloseTo(2);
    expect(result.fA.y).toBeCloseTo(2);
    expect(result.fB.x).toBeCloseTo(-2);
    expect(result.fB.y).toBeCloseTo(-2);
    expect(result.fA.y).toBeGreaterThan(0);
    expect(result.fB.y).toBeLessThan(0);
  });

  it('places both feet on the global line of action', () => {
    expect(result.kind).toBe('push-only');
    if (result.kind !== 'push-only' || result.m === undefined || result.bA === undefined) return;
    const { m, bA, pA, pB } = result;
    const d = state.dAB;
    const gA = { x: pA.x, y: pA.y };
    const gB = { x: pB.x, y: pB.y + d };
    expect(gA.y).toBeCloseTo(m * gA.x + bA);
    expect(gB.y).toBeCloseTo(m * gB.x + bA);
  });

  it('forces produce the applied torques at the lever-arm points', () => {
    expect(result.kind).toBe('push-only');
    if (result.kind !== 'push-only') return;
    expect(torqueFromForceAt(result.pA, result.fA)).toBeCloseTo(state.tauA);
    expect(torqueFromForceAt(result.pB, result.fB)).toBeCloseTo(state.tauB);
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

describe('Tension-only: opposite torque signs select different lines', () => {
  const pick = {
    rA: 0.2,
    rB: 0.1,
    mode: 'coord' as const,
    coordX: -0.2,
    coordY: 0,
  };

  const pos = solve({ ...DEFAULT_INPUT, ...pick, tauA: 2, tauB: 1 });
  const neg = solve({ ...DEFAULT_INPUT, ...pick, tauA: -2, tauB: -1 });

  it('uses different slopes for opposite torque signs', () => {
    expect(pos.kind).toBe('valid');
    if (pos.kind !== 'valid') return;
    expect(pos.m).toBeCloseTo(10 / 3);
    // All torques flipped: line branch changes slope; lever-arm ratio may forbid tension.
    if (neg.kind === 'valid') {
      expect(neg.m).toBeCloseTo(-10 / 3);
      expect(neg.m).not.toBeCloseTo(pos.m!);
    } else {
      expect(neg.kind).toBe('no-solution');
    }
  });

  it('pulls on both wheels instead of pushing apart', () => {
    if (pos.kind !== 'valid') return;
    expect(pos.fA.y).toBeLessThan(0);
    expect(pos.fB.y).toBeGreaterThan(0);
    expect(pos.fA.y * pos.fB.y).toBeLessThan(0);
    if (neg.kind === 'valid') {
      expect(neg.fA.y).toBeLessThan(0);
      expect(neg.fB.y).toBeGreaterThan(0);
      expect(neg.fA.y * neg.fB.y).toBeLessThan(0);
    }
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

  it('reports push-only at θ = 89° when only a pushing solution exists', () => {
    const result = solve(base({ thetaDeg: 89 }));
    expect(result.kind).toBe('push-only');
  });
});

describe('Global line constraint', () => {
  it('keeps b_A − b_B = d_AB for positive and negative S', () => {
    for (const [tauA, tauB] of [
      [1, 1],
      [2, 1],
      [-2, -1],
      [2, -1],
    ] as const) {
      const S = sumTorques(tauA, tauB);
      const { bA, bB } = computeIntercepts(1, tauA, tauB, S);
      expect(bA - bB).toBeCloseTo(1);
    }
  });
});

describe('Feet on line for representative angles', () => {
  const cases: Array<{ thetaDeg: number; kind: 'valid' | 'push-only' }> = [
    { thetaDeg: 0, kind: 'valid' },
    { thetaDeg: 45, kind: 'push-only' },
    { thetaDeg: 120, kind: 'valid' },
    { thetaDeg: 135, kind: 'valid' },
  ];

  for (const { thetaDeg, kind } of cases) {
    it(`θ = ${thetaDeg}° places both feet on y = m·x + b_A`, () => {
      const result = solve(base({ thetaDeg }));
      expect(result.kind).toBe(kind);
      if (!hasPhysicsOutput(result) || result.m === undefined || result.bA === undefined) return;
      const d = 1;
      const gA = { x: result.pA.x, y: result.pA.y };
      const gB = { x: result.pB.x, y: result.pB.y + d };
      expect(gA.y).toBeCloseTo(result.m * gA.x + result.bA);
      expect(gB.y).toBeCloseTo(result.m * gB.x + result.bA);
    });
  }
});

describe('Tension-only forces match applied torques', () => {
  it('at θ = 120° with equal torques', () => {
    const result = solve(base({ thetaDeg: 120 }));
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(torqueFromForceAt(result.pA, result.fA)).toBeCloseTo(1);
    expect(torqueFromForceAt(result.pB, result.fB)).toBeCloseTo(1);
    expect(result.fA.y).toBeLessThan(0);
    expect(result.fB.y).toBeGreaterThan(0);
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
