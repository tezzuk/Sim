// Generates the PWA icons (PNG) without any image dependencies.
// Run once: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(s) {
  const px = Buffer.alloc(s * s * 4);
  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * s + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const cx = s / 2;
  const cy = s * 0.6;
  const R = s * 0.36;
  const ring = s * 0.025;
  const stars = [];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 40; i++) stars.push([Math.floor(rnd() * s), Math.floor(rnd() * s * 0.5)]);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // night sky background
      set(x, y, 11, 16, 32);
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      // ground strip
      if (Math.abs(y - cy) < s * 0.02 && Math.abs(dx) < R * 1.25) set(x, y, 38, 50, 92);
      if (y <= cy) {
        if (d < R - ring) {
          // dome interior glow
          const t = 1 - d / R;
          set(x, y, 22 + 30 * t, 42 + 40 * t, 84 + 60 * t);
        } else if (d <= R) {
          set(x, y, 109, 179, 255); // dome shell
        }
      }
    }
  }
  for (const [sx, sy] of stars) {
    const d = Math.hypot(sx - cx, sy - cy);
    if (d > R + 2) set(sx, sy, 180, 200, 235);
  }
  // the player: a gold pawn inside the dome
  const pr = Math.max(2, s * 0.05);
  const py = cy - s * 0.1;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (Math.hypot(x - cx, y - py) < pr) set(x, y, 255, 209, 102);
    }
  }
  return png(s, s, px);
}

mkdirSync('public/icons', { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, drawIcon(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}
