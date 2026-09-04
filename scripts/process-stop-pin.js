/**
 * Convert stop-pin PNG: punch out solid black (or near-black) background → alpha.
 * Keeps the red pin + gray disc + bus exactly as designed.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const src = process.argv[2];
const dest = process.argv[3] || src;
if (!src) {
  console.error('Usage: node scripts/process-stop-pin.js <src.png> [dest.png]');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(src));
const { width: w, height: h, data } = png;

function isBackground(r, g, b) {
  // Solid black plate behind the pin (this asset)
  if (r <= 25 && g <= 25 && b <= 25) return true;
  // Legacy checker / near-white plate
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max >= 165 && max - min <= 45 && max < 250) {
    // Only treat as bg if not clearly inside a light disc — handled by flood from edges
  }
  return false;
}

function isLightPlate(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max >= 165 && max - min <= 45;
}

// Flood-fill from edges: black OR light checker connected to border → transparent
const seen = new Uint8Array(w * h);
const q = [];
function tryPush(x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (seen[p]) return;
  const o = p * 4;
  const r = data[o];
  const g = data[o + 1];
  const b = data[o + 2];
  if (!(isBackground(r, g, b) || isLightPlate(r, g, b))) return;
  // Don't eat the pin's inner light-gray disc: only flood from edge-connected plate
  seen[p] = 1;
  q.push(p);
}

for (let x = 0; x < w; x++) {
  tryPush(x, 0);
  tryPush(x, h - 1);
}
for (let y = 0; y < h; y++) {
  tryPush(0, y);
  tryPush(w - 1, y);
}

let cleared = 0;
for (let qi = 0; qi < q.length; qi++) {
  const p = q[qi];
  const o = p * 4;
  data[o] = 0;
  data[o + 1] = 0;
  data[o + 2] = 0;
  data[o + 3] = 0;
  cleared += 1;
  const x = p % w;
  const y = (p / w) | 0;
  tryPush(x + 1, y);
  tryPush(x - 1, y);
  tryPush(x, y + 1);
  tryPush(x, y - 1);
}

// Also punch any remaining pure-black islands (shouldn't remain, but safe)
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] === 0) continue;
  if (isBackground(data[i], data[i + 1], data[i + 2])) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    cleared += 1;
  }
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, PNG.sync.write(png));
console.log(`Wrote ${dest} (cleared ${cleared} bg pixels, ${w}x${h})`);
