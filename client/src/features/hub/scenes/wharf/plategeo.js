import { toSun } from './layout.js';

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// where the background plates sit: wrapped on a cylinder around the world origin, azimuth 0 is north, east positive
// single file plates from the first kit, still honoured when present
export const legacyRings = {
  'thames-far-left': { file: 'thames-far-left.png', az0: -150, az1: -50, r: 470, alphaIndex: 1 },
  'thames-far-center': { file: 'thames-far-center.png', az0: -50, az1: 50, r: 470, alphaIndex: 1 },
  'thames-far-right': { file: 'thames-far-right.png', az0: 50, az1: 150, r: 470, alphaIndex: 1 },
  'thames-mid-band': { file: 'thames-mid-band.png', az0: -85, az1: 85, r: 300, alphaIndex: 2 },
};

// numbered pieces: every piece is a 21:9 image cropped to its band, pinned by its own ground line, neighbours overlap by a few degrees
export const pieceSets = {
  far: { r: 470, width: 50, step: 46, count: 6, start: -140, prefix: 'thames-far-', alphaBase: 10, groundFrac: 0.09, overlap: 4, size: [2016, 864],
    // the south arc: the last piece ramps out over the first one across the wrap
    tail: [{ start: 136, width: 44 }, { start: 176, width: 48, fadeRight: true }] },
  mid: { r: 300, width: 46, step: 42, count: 4, start: -86, prefix: 'thames-mid-', alphaBase: 20, groundFrac: 0.1, overlap: 4, size: [2016, 864] },
};

export const pieceRings = {};
for (const [set, d] of Object.entries(pieceSets)) {
  const spans = Array.from({ length: d.count }, (_, i) => ({ az0: d.start + i * d.step, width: d.width }));
  for (const t of d.tail ?? []) spans.push({ az0: t.start, width: t.width, fadeRight: t.fadeRight });
  spans.forEach(({ az0, width, fadeRight }, i) => {
    // only the later piece ramps in over the overlap, so the earlier one stays opaque and no hole can open
    pieceRings[`${d.prefix}${i + 1}`] = { set, index: i, file: `${d.prefix}${i + 1}.webp`, az0, az1: az0 + width, r: d.r, alphaIndex: d.alphaBase + i, groundFrac: d.groundFrac, fadeLeft: i ? d.overlap / width : 0, fadeRight: fadeRight ? d.overlap / width : 0, overlap: d.overlap, columns: width, cropTo: d.size[0] / d.size[1], size: d.size };
  });
}
export const rings = { ...legacyRings, ...pieceRings };

// the ground line of every plate is this far up from its bottom edge and is put at the water level
export const groundFrac = 0.14;
export const groundY = -1.2;
// nominal eye height of the follow camera at the start view (target 1.2 m plus 30 m * cos(1.22)), which is also the horizon height
export const eyeHeight = 11.5;
export const sun = { az: deg(Math.atan2(toSun.x, toSun.z)), el: deg(Math.asin(toSun.y)), discRadius: 3.6 };

// supplied images are fitted by arc length so painted proportions stay true; height follows the image aspect
export function fitFrame(ring, width, height) {
  const arc = ring.r * rad(ring.az1 - ring.az0);
  const heightM = (arc * height) / width;
  const frac = ring.groundFrac ?? groundFrac;
  return { arc, heightM, y0: -frac * heightM + groundY, ppm: width / arc, groundFrac: frac };
}
