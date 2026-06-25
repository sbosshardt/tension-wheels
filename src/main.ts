import './styles.css';
import { Diagram } from './diagram';
import { solve } from './math';
import type { Point2, WheelId } from './types';
import { createUrlDebouncer, loadInputFromUrl } from './urlState';
import { createUI, pickCoordinateOnWheel } from './ui';

function run(): void {
  const app = document.getElementById('app')!;
  let state = loadInputFromUrl();
  const pushUrl = createUrlDebouncer(300);

  const ui = createUI(app, state, (next) => {
    state = next;
    recompute();
  });

  const diagramHost = app.querySelector('#diagram-host') as HTMLElement;
  const controlsPanel = app.querySelector('.controls-panel') as HTMLElement;
  const desktopLayout = window.matchMedia('(min-width: 1101px)');

  function syncDiagramHeight(): void {
    if (!controlsPanel || !diagramHost) return;
    if (desktopLayout.matches) {
      diagramHost.style.height = `${controlsPanel.offsetHeight}px`;
    } else {
      diagramHost.style.height = '';
    }
  }

  const diagram = new Diagram(diagramHost, {
    onWheelClick: (wheel: WheelId, local: Point2) => {
      if (state.mode !== 'coord') return;
      const current = solve(state);
      const partial = pickCoordinateOnWheel(state, wheel, local, current);
      state = { ...state, ...partial };
      if ('setStateFromOutside' in ui && typeof ui.setStateFromOutside === 'function') {
        ui.setStateFromOutside(partial);
      }
      recompute();
    },
  });

  function recompute(): void {
    state = ui.getState();
    const result = solve(state);
    if ('updateResults' in ui && typeof ui.updateResults === 'function') {
      ui.updateResults(result, state);
    }
    diagram.setCoordMode(state.mode === 'coord');
    diagram.render(state, result);
    pushUrl(state);
    requestAnimationFrame(syncDiagramHeight);

    if (result.kind === 'valid' && !result.isVertical && state.mode === 'coord') {
      const thetaPartial = { thetaDeg: result.thetaADeg };
      state = { ...state, ...thetaPartial };
      if ('setStateFromOutside' in ui && typeof ui.setStateFromOutside === 'function') {
        ui.setStateFromOutside(thetaPartial);
      }
    }
  }

  recompute();
  syncDiagramHeight();
  window.addEventListener('resize', syncDiagramHeight);
  if (controlsPanel) {
    new ResizeObserver(syncDiagramHeight).observe(controlsPanel);
  }
}

run();
