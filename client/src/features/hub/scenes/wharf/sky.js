import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { toSun } from './layout.js';
import { glowMaterial } from './toon.js';
import { rng } from '../shared/random.js';

const EL0 = (-15 * Math.PI) / 180;
const EL1 = (90 * Math.PI) / 180;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// value noise on a wrapping lattice, so clouds join up around the full circle
function makeNoise(seed, wrapX) {
  const rand = rng(seed);
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand();
  const at = (x, y) => grid[(((y % size) + size) % size) * size + (((x % wrapX) + wrapX) % wrapX)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = x - xi;
    const ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// sunset gradient sky with painterly cloud banks lit from below and a big soft sun, painted once per mount
export function createSky(scene, { width = 1536, height = 384 } = {}) {
  const texture = new DynamicTexture('sky', { width, height }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext();
  const image = ctx.createImageData(width, height);
  const wrapX = 16;
  const n1 = makeNoise(11, wrapX);
  const n2 = makeNoise(23, wrapX * 2);
  const fbm = (a, e) => {
    const x = (a / (Math.PI * 2)) * wrapX;
    const y = e * 9;
    return n1(x, y) * 0.55 + n1(x * 2, y * 2.3) * 0.28 + n2(x * 4, y * 4.1) * 0.17;
  };
  const zenith = [104, 106, 188];
  const high = [186, 142, 196];
  const low = [255, 168, 138];
  const horizon = [255, 204, 128];
  const below = [255, 196, 140];

  for (let j = 0; j < height; j += 1) {
    const v = 1 - (j + 0.5) / height;
    const el = EL0 + v * (EL1 - EL0);
    for (let i = 0; i < width; i += 1) {
      const az = ((i + 0.5) / width) * Math.PI * 2 - Math.PI;
      const dx = Math.sin(az) * Math.cos(el) - toSun.x;
      const dy = Math.sin(el) - toSun.y;
      const dz = Math.cos(az) * Math.cos(el) - toSun.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // colour bands by elevation
      let c = mixc(zenith, high, 1 - smooth(0.18, 1.1, el));
      c = mixc(c, low, 1 - smooth(0.02, 0.5, el));
      c = mixc(c, horizon, 1 - smooth(-0.02, 0.2, el));
      if (el < 0) c = mixc(horizon, below, smooth(0, 0.2, -el));
      // warm halo, tight inner glow
      const halo = Math.exp(-(d * d) / (2 * 0.55 * 0.55));
      const glow = Math.exp(-(d * d) / (2 * 0.16 * 0.16));
      c = mixc(c, [255, 190, 110], halo * 0.55);
      c = mixc(c, [255, 226, 160], glow * 0.7);
      // cloud banks: stretched noise, three painted tones, bright underside
      const base = fbm(az, el * 1.6);
      const above = fbm(az, el * 1.6 + 0.06);
      const cover = smooth(0.5, 0.58, base) * smooth(-0.04, 0.12, el) * (1 - smooth(0.7, 1.1, el));
      if (cover > 0.001) {
        const under = Math.min(1, Math.max(0, 0.5 + (above - base) * 7));
        const nearSun = Math.exp(-(d * d) / (2 * 0.9 * 0.9));
        let tone = mixc([150, 112, 176], [255, 150, 124], under);
        tone = mixc(tone, [255, 214, 142], smooth(0.55, 1, under) * (0.35 + nearSun * 0.65));
        tone = mixc(tone, [255, 238, 190], smooth(0.9, 1.0, under) * nearSun);
        c = mixc(c, tone, cover * 0.92);
      }
      // the disc itself, with a soft rim
      const disc = 1 - smooth(0.05, 0.075, d);
      c = mixc(c, [255, 249, 226], disc);
      const o = (j * width + i) * 4;
      image.data[o] = c[0];
      image.data[o + 1] = c[1];
      image.data[o + 2] = c[2];
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.update(true);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  // dome with uv = azimuth and elevation, looking inwards
  const rings = 28;
  const segs = 72;
  const radius = 600;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let r = 0; r <= rings; r += 1) {
    const v = r / rings;
    const el = EL0 + v * (EL1 - EL0);
    for (let s = 0; s <= segs; s += 1) {
      const u = s / segs;
      const az = u * Math.PI * 2 - Math.PI;
      pos.push(Math.sin(az) * Math.cos(el) * radius, Math.sin(el) * radius, Math.cos(az) * Math.cos(el) * radius);
      uv.push(u, v);
    }
  }
  for (let r = 0; r < rings; r += 1) {
    for (let s = 0; s < segs; s += 1) {
      const a = r * (segs + 1) + s;
      const b = a + segs + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const dome = new Mesh('sky', scene);
  const data = new VertexData();
  data.positions = new Float32Array(pos);
  data.uvs = new Float32Array(uv);
  data.indices = new Uint16Array(idx);
  data.applyToMesh(dome, false);
  const material = glowMaterial(scene, 'sky', { texture, fog: false, backFaceCulling: false });
  material.disableDepthWrite = true;
  dome.material = material;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.applyFog = false;
  dome.alwaysSelectAsActiveMesh = true;
  dome.renderingGroupId = 0;
  return {
    mesh: dome,
    dispose() {
      dome.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
