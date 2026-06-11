import { MAP_TILES } from '../constants';
import { idx, isWalkable, ix, iy } from './grid';

// Reused scratch buffers — A* runs many times per second.
const N = MAP_TILES * MAP_TILES;
const gScore = new Float32Array(N);
const cameFrom = new Int32Array(N);
const closed = new Uint8Array(N);
const inOpen = new Uint8Array(N);

class Heap {
  items: number[] = [];
  prio: number[] = [];
  size = 0;
  push(item: number, p: number): void {
    let i = this.size++;
    this.items[i] = item;
    this.prio[i] = p;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    this.size--;
    if (this.size > 0) {
      this.items[0] = this.items[this.size];
      this.prio[0] = this.prio[this.size];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.size && this.prio[l] < this.prio[m]) m = l;
        if (r < this.size && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

/**
 * 4-directional A* over the tile grid. Returns the path as packed tile
 * indices ordered for pop(): last element is the FIRST step (start excluded,
 * target included). Returns null when unreachable.
 */
export function findPath(
  tiles: Uint8Array,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): number[] | null {
  if (sx === tx && sy === ty) return [];
  if (!isWalkable(tiles, tx, ty) || !isWalkable(tiles, sx, sy)) return null;

  gScore.fill(Infinity);
  closed.fill(0);
  inOpen.fill(0);
  const heap = new Heap();
  const start = idx(sx, sy);
  const goal = idx(tx, ty);
  gScore[start] = 0;
  cameFrom[start] = -1;
  heap.push(start, Math.abs(tx - sx) + Math.abs(ty - sy));
  inOpen[start] = 1;

  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goal) {
      const path: number[] = [];
      for (let n = goal; n !== start; n = cameFrom[n]) path.push(n);
      return path; // already reversed: path[last] = first step
    }
    closed[cur] = 1;
    const cx = ix(cur);
    const cy = iy(cur);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(tiles, nx, ny)) continue;
      const n = idx(nx, ny);
      if (closed[n]) continue;
      const g = gScore[cur] + 1;
      if (g < gScore[n]) {
        gScore[n] = g;
        cameFrom[n] = cur;
        if (!inOpen[n]) {
          heap.push(n, g + Math.abs(tx - nx) + Math.abs(ty - ny));
          inOpen[n] = 1;
        } else {
          heap.push(n, g + Math.abs(tx - nx) + Math.abs(ty - ny)); // lazy decrease-key
        }
      }
    }
  }
  return null;
}
