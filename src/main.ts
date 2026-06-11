import './style.css';
import { Camera } from './render/camera';
import { InputController } from './render/input';
import { DOME_RADIUS, MAP_TILES, MAX_DPR, TILE_PX, WORLD_PX } from './sim/constants';

// M0 shell: canvas + camera + touch input, drawing a placeholder dome.
// The simulation boots from here in later milestones.

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const camera = new Camera();
let dpr = 1;

function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  camera.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();
camera.fit();

let tapMarker: { x: number; y: number; t: number } | null = null;
new InputController(canvas, camera, (x, y) => {
  tapMarker = { x, y, t: performance.now() };
});

function frame(): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  camera.apply(ctx, dpr);

  const c = WORLD_PX / 2;

  // tile grid
  ctx.strokeStyle = 'rgba(80,100,160,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= MAP_TILES; i++) {
    ctx.moveTo(i * TILE_PX, 0);
    ctx.lineTo(i * TILE_PX, WORLD_PX);
    ctx.moveTo(0, i * TILE_PX);
    ctx.lineTo(WORLD_PX, i * TILE_PX);
  }
  ctx.stroke();

  // dome shell
  ctx.beginPath();
  ctx.arc(c, c, DOME_RADIUS * TILE_PX, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,70,140,0.18)';
  ctx.fill();
  ctx.strokeStyle = '#6db3ff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // central plaza
  ctx.beginPath();
  ctx.arc(c, c, 4 * TILE_PX, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(120,160,230,0.25)';
  ctx.fill();

  if (tapMarker) {
    const age = performance.now() - tapMarker.t;
    if (age < 600) {
      ctx.beginPath();
      ctx.arc(tapMarker.x, tapMarker.y, 6 + age / 40, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,209,102,${1 - age / 600})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      tapMarker = null;
    }
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const hud = document.createElement('div');
hud.style.cssText =
  'position:absolute;top:env(safe-area-inset-top,0);left:0;right:0;text-align:center;' +
  'padding:10px;font-size:14px;color:#9fb4e8;text-shadow:0 1px 3px #000;pointer-events:none';
hud.textContent = 'Lineage — colony shell (M0). Drag to pan, pinch/scroll to zoom.';
document.getElementById('ui')!.appendChild(hud);
