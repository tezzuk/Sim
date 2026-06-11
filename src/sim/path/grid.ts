import { MAP_TILES } from '../constants';
import { T_DOOR, T_FLOOR, T_GROUND, T_ROOM } from '../state';

export const idx = (x: number, y: number): number => y * MAP_TILES + x;
export const ix = (i: number): number => i % MAP_TILES;
export const iy = (i: number): number => Math.floor(i / MAP_TILES);

export function isWalkable(tiles: Uint8Array, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES) return false;
  const t = tiles[idx(x, y)];
  return t === T_GROUND || t === T_FLOOR || t === T_DOOR || t === T_ROOM;
}
