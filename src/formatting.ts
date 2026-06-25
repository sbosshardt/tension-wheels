import { isNearVerticalAngle, normalizeAngle0to360, radToDeg } from './math';
import type { Force2 } from './types';

/** Round to 3 decimals and strip trailing zeros. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded.toString();
}

export function formatWithUnit(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}

export function formatMeters(value: number): string {
  return formatWithUnit(value, 'm');
}

export function formatNewtons(value: number): string {
  return formatWithUnit(value, 'N');
}

export function formatTorque(value: number): string {
  return formatWithUnit(value, 'N·m');
}

export function formatDegrees(value: number): string {
  return formatWithUnit(normalizeAngle0to360(value), '°');
}

export function formatCoordinate(x: number, y: number): string {
  return `(${formatNumber(x)}, ${formatNumber(y)})`;
}

export function formatForceIj(f: Force2): string {
  const xi = formatNumber(f.x);
  const yi = formatNumber(f.y);
  const xPart = f.x === 0 ? '0' : `${xi} i`;
  const yPart = f.y === 0 ? '0' : `${yi} j`;
  if (f.x === 0 && f.y === 0) return '0 N';
  if (f.x === 0) return `${yPart} N`;
  if (f.y === 0) return `${xPart} N`;
  const xSign = f.x > 0 ? `${xi} i` : `${xi} i`;
  const ySign = f.y > 0 ? `+ ${yi} j` : `- ${formatNumber(Math.abs(f.y))} j`;
  return `${xSign} ${ySign} N`;
}

export function forceAngleDeg(f: Force2): number {
  return normalizeAngle0to360((radToDeg(Math.atan2(f.y, f.x))));
}

const SLOPE_LARGE = 1e4;

export function formatSlope(m: number | undefined, thetaDeg?: number): string {
  if (m === undefined) return 'Undefined';
  if (thetaDeg !== undefined && isNearVerticalAngle(thetaDeg)) {
    return 'Undefined (vertical)';
  }
  if (!Number.isFinite(m)) return 'Undefined';
  if (Math.abs(m) > SLOPE_LARGE) return 'Very large';
  return formatNumber(m);
}

export function formatLineEquationA(m: number | undefined, bA: number | undefined): string {
  if (m === undefined || bA === undefined) return 'N/A';
  return `y_A = ${formatSlope(-m)}·x_A + ${formatNumber(-bA)} m`;
}

export function formatLineEquationB(m: number | undefined, bB: number | undefined): string {
  if (m === undefined || bB === undefined) return 'N/A';
  return `y_B = ${formatSlope(-m)}·x_B + ${formatNumber(-bB)} m`;
}

export function formatVerticalLine(c: number | undefined): string {
  if (c === undefined) return 'x = c (choose offset)';
  return `x = ${formatNumber(c)} m`;
}
