import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';

// the skyline plates shipped in public/hub/plates, listed statically so nothing is requested blindly
const plateFiles = [1, 2, 3, 4, 5, 6].map((n) => `thames-far-${n}.webp`).concat([1, 2, 3, 4].map((n) => `thames-mid-${n}.webp`));

export function loadIndexes() {
  return { plates: new Set(plateFiles) };
}

// resolves null when the file fails, so callers can fall back to a procedural stand-in
export function loadTexture(scene, url, { wrap = false } = {}) {
  return new Promise((resolve) => {
    const texture = new Texture(url, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, () => resolve(texture), () => resolve(null));
    texture.anisotropicFilteringLevel = 8;
    texture.wrapU = wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  });
}
