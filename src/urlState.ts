import { DEFAULT_INPUT, type InputState, type SolveMode, type WheelId } from './types';

const DEFAULTS = DEFAULT_INPUT;

function parseFloatParam(value: string | null): number | undefined {
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseMode(value: string | null): SolveMode | undefined {
  if (value === 'angle' || value === 'coord') return value;
  return undefined;
}

function parseWheel(value: string | null): WheelId | undefined {
  if (value === 'A' || value === 'B') return value;
  return undefined;
}

export function parseInputFromUrl(search: string): Partial<InputState> {
  const params = new URLSearchParams(search);
  const partial: Partial<InputState> = {};

  const d = parseFloatParam(params.get('d'));
  const ra = parseFloatParam(params.get('ra'));
  const rb = parseFloatParam(params.get('rb'));
  const ta = parseFloatParam(params.get('ta'));
  const tb = parseFloatParam(params.get('tb'));
  const theta = parseFloatParam(params.get('theta'));
  const mode = parseMode(params.get('mode'));
  const wheel = parseWheel(params.get('wheel'));
  const x = parseFloatParam(params.get('x'));
  const y = parseFloatParam(params.get('y'));
  const c = parseFloatParam(params.get('c'));
  const wheel2 = parseWheel(params.get('wheel2'));
  const x2 = parseFloatParam(params.get('x2'));
  const y2 = parseFloatParam(params.get('y2'));

  if (d !== undefined) partial.dAB = d;
  if (ra !== undefined) partial.rA = ra;
  if (rb !== undefined) partial.rB = rb;
  if (ta !== undefined) partial.tauA = ta;
  if (tb !== undefined) partial.tauB = tb;
  if (theta !== undefined) partial.thetaDeg = theta;
  if (mode !== undefined) partial.mode = mode;
  if (wheel !== undefined) partial.coordWheel = wheel;
  if (x !== undefined) partial.coordX = x;
  if (y !== undefined) partial.coordY = y;
  if (c !== undefined) partial.verticalOffsetC = c;
  if (wheel2 !== undefined) partial.secondCoordWheel = wheel2;
  if (x2 !== undefined) partial.secondCoordX = x2;
  if (y2 !== undefined) partial.secondCoordY = y2;

  return partial;
}

export function mergeWithDefaults(partial: Partial<InputState>): InputState {
  return { ...DEFAULTS, ...partial };
}

export function loadInputFromUrl(): InputState {
  const partial = parseInputFromUrl(window.location.search);
  return mergeWithDefaults(partial);
}

function setIfNotDefault(params: URLSearchParams, key: string, value: number, defaultValue: number): void {
  if (Math.abs(value - defaultValue) > 1e-12) {
    params.set(key, formatNumber(value));
  }
}

function formatNumber(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function serializeInputToSearch(state: InputState): string {
  const params = new URLSearchParams();

  setIfNotDefault(params, 'd', state.dAB, DEFAULTS.dAB);
  setIfNotDefault(params, 'ra', state.rA, DEFAULTS.rA);
  setIfNotDefault(params, 'rb', state.rB, DEFAULTS.rB);
  setIfNotDefault(params, 'ta', state.tauA, DEFAULTS.tauA);
  setIfNotDefault(params, 'tb', state.tauB, DEFAULTS.tauB);

  if (state.mode !== DEFAULTS.mode) {
    params.set('mode', state.mode);
  }

  if (state.mode === 'angle') {
    setIfNotDefault(params, 'theta', state.thetaDeg, DEFAULTS.thetaDeg);
    const S = state.tauA + state.tauB;
    if (Math.abs(S) < 1e-9 && Math.abs(state.verticalOffsetC - DEFAULTS.verticalOffsetC) > 1e-12) {
      params.set('c', formatNumber(state.verticalOffsetC));
    }
  } else {
    if (state.coordWheel !== DEFAULTS.coordWheel) params.set('wheel', state.coordWheel);
    setIfNotDefault(params, 'x', state.coordX, DEFAULTS.coordX);
    setIfNotDefault(params, 'y', state.coordY, DEFAULTS.coordY);
    if (state.secondCoordWheel !== undefined) {
      params.set('wheel2', state.secondCoordWheel);
      if (state.secondCoordX !== undefined) params.set('x2', formatNumber(state.secondCoordX));
      if (state.secondCoordY !== undefined) params.set('y2', formatNumber(state.secondCoordY));
    }
    const S = state.tauA + state.tauB;
    if (Math.abs(S) < 1e-9) {
      params.set('c', formatNumber(state.coordX));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function createUrlDebouncer(delayMs = 300): (state: InputState) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (state: InputState) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      const search = serializeInputToSearch(state);
      const url = `${window.location.pathname}${search}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }, delayMs);
  };
}
