import {
  formatCoordinate,
  formatDegrees,
  formatForceIj,
  formatLineEquationA,
  formatLineEquationB,
  formatMeters,
  formatNewtons,
  formatNumber,
  formatPhysicsCoordinate,
  formatSlope,
  formatTorque,
  formatVerticalLine,
  forceAngleDeg,
} from './formatting';
import { linkedAngleBDeg, sumTorques } from './math';
import type { InputState, Point2, SolveResult, WheelId } from './types';

export type InputChangeHandler = (state: InputState) => void;

export interface UIElements {
  root: HTMLElement;
  getState: () => InputState;
}

function numInput(id: string, label: string, min?: number, max?: number, step = 'any'): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lbl = document.createElement('label');
  lbl.htmlFor = id;
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.step = step;
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  wrap.append(lbl, input);
  return wrap;
}

function rangeInput(id: string, label: string, min: number, max: number, step: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'field field-range';
  const lbl = document.createElement('label');
  lbl.htmlFor = id;
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  wrap.append(lbl, input);
  return wrap;
}

export function createUI(
  container: HTMLElement,
  initial: InputState,
  onChange: InputChangeHandler,
): UIElements {
  let state = { ...initial };
  let updating = false;

  const emit = () => {
    if (updating) return;
    onChange({ ...state });
  };

  const setState = (partial: Partial<InputState>) => {
    state = { ...state, ...partial };
    syncControlsFromState();
    emit();
  };

  container.innerHTML = `
    <header class="app-header">
      <h1>tension-wheels</h1>
      <p class="subtitle">Rubber-band line-of-action calculator for two separated wheels</p>
    </header>
    <div class="layout">
      <section class="panel controls-panel" aria-label="Inputs"></section>
      <div class="workspace">
        <section class="panel diagram-panel" aria-label="Diagram">
          <div id="diagram-host"></div>
        </section>
        <section class="panel results-panel" aria-label="Results"></section>
      </div>
    </div>
  `;

  const controlsPanel = container.querySelector('.controls-panel')!;
  const resultsPanel = container.querySelector('.results-panel')!;

  // Mode toggle
  const modeField = document.createElement('fieldset');
  modeField.className = 'mode-toggle';
  modeField.innerHTML = '<legend>Solve mode</legend>';
  const modeOptions = document.createElement('div');
  modeOptions.className = 'mode-options';

  const angleLabel = document.createElement('label');
  angleLabel.className = 'mode-option';
  const angleRadio = document.createElement('input');
  angleRadio.type = 'radio';
  angleRadio.name = 'mode';
  angleRadio.id = 'mode-angle';
  angleRadio.value = 'angle';
  angleLabel.append(angleRadio, document.createTextNode(' Angle'));

  const coordLabel = document.createElement('label');
  coordLabel.className = 'mode-option';
  const coordRadio = document.createElement('input');
  coordRadio.type = 'radio';
  coordRadio.name = 'mode';
  coordRadio.id = 'mode-coord';
  coordRadio.value = 'coord';
  coordLabel.append(coordRadio, document.createTextNode(' Coordinate'));

  modeOptions.append(angleLabel, coordLabel);
  modeField.append(modeOptions);
  controlsPanel.appendChild(modeField);

  const geomGroup = document.createElement('div');
  geomGroup.className = 'input-group';
  geomGroup.innerHTML = '<h2>Geometry</h2>';
  const dField = numInput('dAB', 'Axle distance d_AB (m)', 0.001);
  const rAField = numInput('rA', 'Wheel A radius R_A (m)', 0.001);
  const rBField = numInput('rB', 'Wheel B radius R_B (m)', 0.001);
  geomGroup.append(dField, rAField, rBField);
  controlsPanel.appendChild(geomGroup);

  const torqueGroup = document.createElement('div');
  torqueGroup.className = 'input-group';
  torqueGroup.innerHTML = '<h2>Torques</h2>';
  const tauAField = numInput('tauA', 'Torque on A τ_A (N·m)');
  const tauBField = numInput('tauB', 'Torque on B τ_B (N·m)');
  torqueGroup.append(tauAField, tauBField);
  controlsPanel.appendChild(torqueGroup);

  const angleGroup = document.createElement('div');
  angleGroup.className = 'input-group angle-group';
  angleGroup.innerHTML = '<h2>Line of action (angle mode)</h2>';
  const thetaAField = numInput('thetaA', 'Angle from A θ (°)', 0, 360, '0.1');
  const thetaBField = numInput('thetaB', 'Angle from B θ (°)', 0, 360, '0.1');
  const thetaASlider = rangeInput('thetaASlider', 'θ from A', 0, 360, 0.5);
  const slopeDisplay = document.createElement('p');
  slopeDisplay.className = 'derived';
  slopeDisplay.id = 'slope-display';
  angleGroup.append(thetaAField, thetaASlider, thetaBField, slopeDisplay);
  controlsPanel.appendChild(angleGroup);

  const verticalGroup = document.createElement('div');
  verticalGroup.className = 'input-group vertical-group hidden';
  verticalGroup.innerHTML = '<h2>Vertical line offset</h2>';
  const cField = numInput('verticalC', 'x-offset c (m) when τ_A + τ_B = 0');
  verticalGroup.append(cField);
  controlsPanel.appendChild(verticalGroup);

  const coordGroup = document.createElement('div');
  coordGroup.className = 'input-group coord-group hidden';
  coordGroup.innerHTML = '<h2>Coordinate mode</h2>';
  const wheelField = document.createElement('div');
  wheelField.className = 'field';
  const wheelLabel = document.createElement('label');
  wheelLabel.htmlFor = 'coordWheel';
  wheelLabel.textContent = 'Selected wheel';
  const wheelSelect = document.createElement('select');
  wheelSelect.id = 'coordWheel';
  wheelSelect.innerHTML = '<option value="A">Wheel A</option><option value="B">Wheel B</option>';
  wheelField.append(wheelLabel, wheelSelect);
  const coordXField = numInput('coordX', 'x (m)');
  const coordYField = numInput('coordY', 'y (m)');
  const coordHint = document.createElement('p');
  coordHint.className = 'hint';
  coordHint.textContent =
    'Click a wheel in the diagram or edit x/y. Coordinates use each wheel’s local frame (y downward, matching the diagram).';
  coordGroup.append(wheelField, coordXField, coordYField, coordHint);
  controlsPanel.appendChild(coordGroup);

  resultsPanel.innerHTML = `
    <div id="status-banner" class="status-banner" role="status"></div>
    <details class="how-to-read">
      <summary>How to read this</summary>
      <ul>
        <li><strong>Diagram numbers</strong> use each wheel’s local frame with <strong>y downward</strong> (toward B). θ is from +x toward that +y (90° points toward B).</li>
        <li><strong>Physics y↑</strong> in the results table negates y for engineering convention.</li>
        <li>Torque relation (physics y↑): τ = x·F_y − y·F_x (CCW positive).</li>
        <li>Dashed gray lines are local <strong>x-axes</strong> through each axle. At θ = 0° or 180°, the line of action is parallel to these axes.</li>
        <li>The gray <strong>b_A</strong> marker is where the line crosses wheel A’s local y-axis. Torques fix b_A; the line does not pass through the axle unless b_A = 0.</li>
        <li>Red dots are perpendicular lever-arm points, not every chord attachment.</li>
        <li>θ = 90° or 270° is invalid unless τ_A + τ_B = 0.</li>
      </ul>
    </details>
    <div id="results-content"></div>
  `;

  const getInput = (wrap: HTMLElement) => wrap.querySelector('input') as HTMLInputElement;

  const bindNumber = (wrap: HTMLElement, key: keyof InputState, onUpdate?: (v: number) => void) => {
    const input = getInput(wrap);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      if (onUpdate) onUpdate(v);
      else setState({ [key]: v } as Partial<InputState>);
    });
  };

  bindNumber(dField, 'dAB');
  bindNumber(rAField, 'rA');
  bindNumber(rBField, 'rB');
  bindNumber(tauAField, 'tauA');
  bindNumber(tauBField, 'tauB');
  bindNumber(cField, 'verticalOffsetC');

  const thetaAInput = getInput(thetaAField);
  const thetaBInput = getInput(thetaBField);
  const thetaASliderInput = getInput(thetaASlider);

  const setThetaA = (deg: number) => {
    state.thetaDeg = ((deg % 360) + 360) % 360;
    syncControlsFromState();
    emit();
  };

  thetaAInput.addEventListener('input', () => setThetaA(Number(thetaAInput.value)));
  thetaASliderInput.addEventListener('input', () => setThetaA(Number(thetaASliderInput.value)));
  thetaBInput.addEventListener('input', () => {
    const b = Number(thetaBInput.value);
    setThetaA(linkedAngleBDeg(b));
  });

  angleRadio.addEventListener('change', () => {
    if (angleRadio.checked) setState({ mode: 'angle' });
  });
  coordRadio.addEventListener('change', () => {
    if (coordRadio.checked) setState({ mode: 'coord', secondCoordWheel: undefined, secondCoordX: undefined, secondCoordY: undefined });
  });

  wheelSelect.addEventListener('change', () => {
    setState({
      coordWheel: wheelSelect.value as WheelId,
      secondCoordWheel: undefined,
      secondCoordX: undefined,
      secondCoordY: undefined,
    });
  });
  bindNumber(coordXField, 'coordX', (v) => {
    setState({ coordX: v, secondCoordWheel: undefined, secondCoordX: undefined, secondCoordY: undefined });
  });
  bindNumber(coordYField, 'coordY', (v) => {
    setState({ coordY: v, secondCoordWheel: undefined, secondCoordX: undefined, secondCoordY: undefined });
  });

  function syncControlsFromState() {
    updating = true;
    const s = state;
    getInput(dField).value = String(s.dAB);
    getInput(rAField).value = String(s.rA);
    getInput(rBField).value = String(s.rB);
    getInput(tauAField).value = String(s.tauA);
    getInput(tauBField).value = String(s.tauB);
    getInput(cField).value = String(s.verticalOffsetC);
    thetaAInput.value = String(s.thetaDeg);
    thetaBInput.value = String(linkedAngleBDeg(s.thetaDeg));
    thetaASliderInput.value = String(s.thetaDeg);
    angleRadio.checked = s.mode === 'angle';
    coordRadio.checked = s.mode === 'coord';
    wheelSelect.value = s.coordWheel;
    getInput(coordXField).value = String(s.coordX);
    getInput(coordYField).value = String(s.coordY);

    angleGroup.classList.toggle('hidden', s.mode !== 'angle');
    coordGroup.classList.toggle('hidden', s.mode !== 'coord');

    const S = sumTorques(s.tauA, s.tauB);
    const verticalCase = Math.abs(S) < 1e-9 && (Math.abs(s.tauA) > 1e-9 || Math.abs(s.tauB) > 1e-9);
    verticalGroup.classList.toggle('hidden', s.mode !== 'angle' || !verticalCase);

    updating = false;
  }

  syncControlsFromState();

  return {
    root: container,
    getState: () => ({ ...state }),
    setStateFromOutside: (partial: Partial<InputState>) => {
      state = { ...state, ...partial };
      syncControlsFromState();
    },
    updateResults: (result: SolveResult, input: InputState) => {
      renderResults(result, input);
      const S = sumTorques(input.tauA, input.tauB);
      if (result.kind === 'valid' && !result.isVertical && result.m !== undefined) {
        slopeDisplay.textContent = `Slope m = ${formatSlope(result.m, result.thetaADeg)} · b_A = ${formatNumber(result.bA!)} m`;
      } else if (result.kind === 'no-solution' && input.mode === 'angle') {
        slopeDisplay.textContent = formatSlope(undefined, input.thetaDeg);
      } else if (result.kind === 'valid' && result.isVertical) {
        slopeDisplay.textContent = 'Slope: Undefined (vertical line)';
      } else {
        slopeDisplay.textContent = '';
      }
      verticalGroup.classList.toggle(
        'hidden',
        input.mode !== 'angle' || !(Math.abs(S) < 1e-9 && (Math.abs(input.tauA) > 1e-9 || Math.abs(input.tauB) > 1e-9)),
      );
    },
  } as UIElements & {
    setStateFromOutside: (partial: Partial<InputState>) => void;
    updateResults: (result: SolveResult, input: InputState) => void;
  };
}

function renderResults(result: SolveResult, input: InputState): void {
  const banner = document.getElementById('status-banner')!;
  const content = document.getElementById('results-content')!;
  banner.className = 'status-banner ' + statusClass(result);

  if (input.rA + input.rB >= input.dAB) {
    banner.textContent =
      'Warning: R_A + R_B ≥ d_AB — wheels overlap or touch. Results may not represent separated wheels.';
    banner.className = 'status-banner warning';
  } else {
    banner.textContent = statusMessage(result);
  }

  if (result.kind === 'zero-torques') {
    content.innerHTML = '<p class="muted">Enter at least one nonzero torque to compute tension.</p>';
    return;
  }

  if (result.kind === 'needs-offset') {
    content.innerHTML =
      '<p>Equal and opposite torques require a <strong>vertical</strong> line of action. Set a nonzero x-offset <em>c</em> above.</p>';
    return;
  }

  if (result.kind === 'infinite-slopes') {
    content.innerHTML = `
      <p><strong>Multiple line angles are possible.</strong> Choose an attachment point in the highlighted region on wheel ${result.otherWheel} (any point with x ≠ 0) to fix the line angle and tension.</p>
    `;
    return;
  }

  if (result.kind === 'no-solution') {
    content.innerHTML = `<p>${result.reason}</p>`;
    return;
  }

  const S = result.S;
  const radiusNote = [];
  if (!result.radiusValidA) radiusNote.push('wheel A');
  if (!result.radiusValidB) radiusNote.push('wheel B');
  const radiusWarning =
    radiusNote.length > 0
      ? `<p class="warning-text">The current line of action does not intersect ${radiusNote.join(' and ')} at the specified radius.</p>`
      : '';

  const lineSection = result.isVertical
    ? `
      <p>Vertical line: ${formatVerticalLine(result.verticalC)}</p>
      <p>Slope: Undefined</p>
      <p>Intercepts: N/A (vertical)</p>
    `
    : `
      <p>θ from A: ${formatDegrees(result.thetaADeg)}</p>
      <p>θ from B: ${formatDegrees(result.thetaBDeg)}</p>
      <p>Slope m: ${formatSlope(result.m, result.thetaADeg)}</p>
      <p>${formatLineEquationA(result.m, result.bA)}</p>
      <p>${formatLineEquationB(result.m, result.bB)}</p>
      <p>b_A: ${formatMeters(result.bA!)} · b_B: ${formatMeters(result.bB!)}</p>
    `;

  content.innerHTML = `
    ${radiusWarning}
    <section class="result-section">
      <h2>Input summary</h2>
      <table class="result-table">
        <tr><td>d_AB</td><td>${formatMeters(input.dAB)}</td></tr>
        <tr><td>R_A</td><td>${formatMeters(input.rA)}</td></tr>
        <tr><td>R_B</td><td>${formatMeters(input.rB)}</td></tr>
        <tr><td>τ_A</td><td>${formatTorque(input.tauA)}</td></tr>
        <tr><td>τ_B</td><td>${formatTorque(input.tauB)}</td></tr>
        <tr><td>S = τ_A + τ_B</td><td>${formatTorque(S)}</td></tr>
      </table>
    </section>
    <section class="result-section">
      <h2>Line of action</h2>
      ${lineSection}
    </section>
    <section class="result-section">
      <h2>Lever-arm points</h2>
      <p class="hint">Local (y↓) matches the diagram. Physics y↑ negates y.</p>
      <table class="result-table">
        <tr><td>P_A (diagram)</td><td>${formatCoordinate(result.pA.x, result.pA.y)}</td></tr>
        <tr><td>P_A (physics y↑)</td><td>${formatPhysicsCoordinate(result.pA.x, result.pA.y)}</td></tr>
        <tr><td>P_B (diagram)</td><td>${formatCoordinate(result.pB.x, result.pB.y)}</td></tr>
        <tr><td>P_B (physics y↑)</td><td>${formatPhysicsCoordinate(result.pB.x, result.pB.y)}</td></tr>
        <tr><td>L_A</td><td>${formatMeters(result.lA)}</td></tr>
        <tr><td>L_B</td><td>${formatMeters(result.lB)}</td></tr>
      </table>
    </section>
    <section class="result-section">
      <h2>Forces</h2>
      <p><strong>Force on A</strong></p>
      <table class="result-table">
        <tr><td>Magnitude</td><td>${formatNewtons(result.tension)}</td></tr>
        <tr><td>Angle</td><td>${formatDegrees(forceAngleDeg(result.fA))}</td></tr>
        <tr><td>i/j form</td><td>${formatForceIj(result.fA)}</td></tr>
      </table>
      <p><strong>Force on B</strong></p>
      <table class="result-table">
        <tr><td>Magnitude</td><td>${formatNewtons(result.tension)}</td></tr>
        <tr><td>Angle</td><td>${formatDegrees(forceAngleDeg(result.fB))}</td></tr>
        <tr><td>i/j form</td><td>${formatForceIj(result.fB)}</td></tr>
      </table>
    </section>
  `;
}

function statusClass(result: SolveResult): string {
  switch (result.kind) {
    case 'valid':
      return 'ok';
    case 'zero-torques':
    case 'no-solution':
      return 'error';
    case 'infinite-slopes':
    case 'needs-offset':
      return 'info';
    default:
      return '';
  }
}

function statusMessage(result: SolveResult): string {
  switch (result.kind) {
    case 'valid':
      if (!result.radiusValidA || !result.radiusValidB) {
        return 'Valid solution, but the line of action does not intersect one or both wheels at the specified radius.';
      }
      return 'Valid solution.';
    case 'no-solution':
      return `No solution: ${result.reason}`;
    case 'infinite-slopes':
      return 'Multiple line angles are possible. Choose a point on the highlighted wheel (x ≠ 0).';
    case 'zero-torques':
      return 'Choose at least one nonzero torque. This calculator assumes the rubber band has nonzero tension.';
    case 'needs-offset':
      return 'Vertical line required. Choose a nonzero x-offset c to determine tension.';
    default:
      return '';
  }
}

export function pickCoordinateOnWheel(
  _state: InputState,
  wheel: WheelId,
  local: Point2,
  result: SolveResult,
): Partial<InputState> {
  if (result.kind === 'infinite-slopes' && wheel === result.otherWheel) {
    return {
      secondCoordWheel: wheel,
      secondCoordX: local.x,
      secondCoordY: local.y,
    };
  }
  return {
    coordWheel: wheel,
    coordX: local.x,
    coordY: local.y,
    secondCoordWheel: undefined,
    secondCoordX: undefined,
    secondCoordY: undefined,
  };
}

export function applyExternalState(
  ui: UIElements & { setStateFromOutside?: (p: Partial<InputState>) => void },
  partial: Partial<InputState>,
): void {
  if ('setStateFromOutside' in ui && ui.setStateFromOutside) {
    ui.setStateFromOutside(partial);
  }
}
