import { render } from 'preact';
import { h } from 'preact';
import './style.css';
import { GameLoop } from './app/gameLoop';
import { loadLocal, saveLocal } from './app/persistence';
import { Camera } from './render/camera';
import { InputController } from './render/input';
import { Renderer } from './render/renderer';
import { AUTOSAVE_MS, MAX_DPR, TILE_PX } from './sim/constants';
import { Sim } from './sim/sim';
import { playerColonist } from './sim/state';
import { newColony } from './sim/worldgen';
import { App } from './ui/App';
import { centerOnPlayer, refreshUi, selection, simRef } from './ui/store';

// ---- boot the sim (load save or found a new colony) ----
simRef.current = loadLocal() ?? new Sim(newColony((Math.random() * 2 ** 32) >>> 0));

// ---- canvas / camera / renderer ----
const canvas = document.getElementById('game') as HTMLCanvasElement;
const camera = new Camera();
const renderer = new Renderer(canvas, camera);

function resize(): void {
  renderer.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(window.innerWidth * renderer.dpr);
  canvas.height = Math.round(window.innerHeight * renderer.dpr);
  camera.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();
camera.fit();
camera.zoom = Math.max(camera.zoom, 0.9);

centerOnPlayer.current = () => {
  const sim = simRef.current!;
  const p = playerColonist(sim.state);
  if (p) {
    camera.x = p.x * TILE_PX;
    camera.y = p.y * TILE_PX;
    camera.zoom = Math.max(camera.zoom, 1.6);
  }
};
// boot framing: centered on the player, wide enough to see the colony
{
  const p = playerColonist(simRef.current.state);
  if (p) {
    camera.x = p.x * TILE_PX;
    camera.y = p.y * TILE_PX;
  }
  camera.zoom = Math.max(camera.zoom, Math.min(1.0, window.innerWidth / 900));
}

let lastAlpha = 0;
new InputController(canvas, camera, (wx, wy) => {
  const sim = simRef.current!;
  selection.value = renderer.hitTest(sim.state, wx, wy, lastAlpha);
  refreshUi();
});

// ---- the loop ----
const loop = new GameLoop(
  () => simRef.current!.tick(),
  (alpha) => {
    lastAlpha = alpha;
    renderer.frame(simRef.current!.state, alpha, selection.value);
  },
  () => simRef.current!.state.speed,
);
loop.start();

// ---- UI ----
render(h(App, null), document.getElementById('ui')!);
setInterval(refreshUi, 250);

// ---- persistence hooks ----
setInterval(() => saveLocal(simRef.current!), AUTOSAVE_MS);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveLocal(simRef.current!);
});
window.addEventListener('pagehide', () => saveLocal(simRef.current!));

// ---- keyboard (desktop) ----
window.addEventListener('keydown', (e) => {
  const s = simRef.current!.state;
  if (s.succession) return;
  if (e.key === ' ') {
    s.speed = s.speed === 0 ? 1 : 0;
    e.preventDefault();
  } else if (e.key === '1') s.speed = 1;
  else if (e.key === '2') s.speed = 3;
  else if (e.key === '3') s.speed = 10;
  refreshUi();
});

// ---- debug overlay (?debug=1) ----
if (new URLSearchParams(location.search).has('debug')) {
  const el = document.createElement('div');
  el.className = 'debug-overlay';
  document.getElementById('ui')!.appendChild(el);
  setInterval(() => {
    const sim = simRef.current!;
    const pop = sim.state.colonists.filter((c) => c.alive).length;
    el.textContent =
      `fps ${renderer.fps}  tick ${sim.tickMsAvg.toFixed(2)}ms\n` +
      `pop ${pop}  tick# ${sim.state.tick}  zoom ${camera.zoom.toFixed(2)}`;
  }, 500);
}
