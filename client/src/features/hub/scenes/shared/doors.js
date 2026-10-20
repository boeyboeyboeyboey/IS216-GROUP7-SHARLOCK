import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';

// ground point just outside a door; face is the yaw of the facade normal
export const doorSpot = (info, reach = info.reach) => ({ x: info.x + Math.sin(info.face) * reach, z: info.z + Math.cos(info.face) * reach });

// camera alpha nearest to a wanted angle, wrapped next to the allowed range before clamping
export function clampAlpha(camera, wanted) {
  const lo = camera.lowerAlphaLimit ?? -9;
  const hi = camera.upperAlphaLimit ?? 9;
  const mid = (lo + hi) / 2;
  while (wanted > mid + Math.PI) wanted -= Math.PI * 2;
  while (wanted < mid - Math.PI) wanted += Math.PI * 2;
  return Math.min(hi, Math.max(lo, wanted));
}

export function ringTexture(scene) {
  const texture = new DynamicTexture('door-ring', 256, scene, true);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 256, 256);
  const fill = ctx.createRadialGradient(128, 128, 0, 128, 128, 120);
  fill.addColorStop(0, 'rgba(255,255,255,0.22)');
  fill.addColorStop(0.75, 'rgba(255,255,255,0.1)');
  fill.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 9;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 98, 0, Math.PI * 2);
  ctx.stroke();
  texture.update();
  texture.hasAlpha = true;
  return texture;
}

// door triggers and the select / enter / back flow shared by every walkable scene
// infos: [{ id, title, accent, x, z, face, reach, focus?: { x, y, z }, view?: { radius, beta } }]
export function createDoors({ scene, state, notify, infos, control, camera, reduced, groundY = () => 0, onGlow = null, ringRadius = 1.05, ringMaterial = null }) {
  const infoOf = (id) => infos.find((i) => i.id === id);
  const glow = new Map(infos.map((i) => [i.id, 0]));

  const discs = infos.map((info) => {
    const spot = doorSpot(info, info.reach);
    const disc = CreateDisc(`marker-${info.id}`, { radius: ringRadius, tessellation: 40 }, scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(spot.x, groundY(spot.x, spot.z) + 0.05, spot.z);
    return { id: info.id, mesh: disc, accent: Color3.FromHexString(info.accent) };
  });
  const perDisc = discs[0].mesh.getTotalVertices();
  const ringColors = new Float32Array(discs.length * perDisc * 4);
  discs.forEach((d, i) => {
    for (let v = 0; v < perDisc; v += 1) ringColors.set([d.accent.r, d.accent.g, d.accent.b, 0.4], (i * perDisc + v) * 4);
    d.mesh.setVerticesData(VertexBuffer.ColorKind, ringColors.slice(i * perDisc * 4, (i + 1) * perDisc * 4));
  });
  const ringMesh = Mesh.MergeMeshes(discs.map((d) => d.mesh), true, true, undefined, false, false);
  ringMesh.name = 'door-rings';
  ringMesh.hasVertexAlpha = true;
  ringMesh.isPickable = false;
  ringMesh.setVerticesData(VertexBuffer.ColorKind, ringColors, true);
  // custom materials may read a second uv set
  ringMesh.setVerticesData(VertexBuffer.UV2Kind, new Float32Array(ringMesh.getTotalVertices() * 2));
  let ownMaterial = null;
  if (!ringMaterial) {
    ownMaterial = new StandardMaterial('door-rings-mat', scene);
    ownMaterial.disableLighting = true;
    ownMaterial.emissiveTexture = ringTexture(scene);
    ownMaterial.opacityTexture = ownMaterial.emissiveTexture;
    ownMaterial.backFaceCulling = false;
    ownMaterial.alphaMode = Constants.ALPHA_ADD;
    ownMaterial.fogEnabled = false;
  }
  ringMesh.material = ringMaterial ?? ownMaterial;
  ringMesh.useVertexColors = true;
  ringMesh.alphaIndex = 50;

  let entering = false;
  let ringDirty = false;
  let saved = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius };
  // the normal follow view, which a deselect settles back into
  const home = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius };

  const select = (id) => {
    state.selected = id;
    notify();
    if (!id) {
      // stop where the player stands and ease the camera back to the follow view
      control.cancelRoute();
      const p = control.position();
      control.flyTo({ target: new Vector3(p.x, p.y + 0.4, p.z), ...home }, 0.7).then(() => {
        if (!state.selected && !entering) control.releaseCamera();
      });
      return;
    }
    const info = infoOf(id);
    control.routeToDoor(id);
    // face the shopfront from the open side
    const side = clampAlpha(camera, Math.PI / 2 - info.face);
    const focus = info.focus ?? { x: info.x, y: 1.6, z: info.z };
    control.flyTo({ target: new Vector3(focus.x, focus.y, focus.z), radius: info.view?.radius ?? 14, beta: info.view?.beta ?? 1.0, alpha: side }, 1.0);
  };

  const enter = async (id = state.selected) => {
    if (!id || entering) return false;
    const info = infoOf(id);
    entering = true;
    control.setEnabled(false);
    saved = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius };
    state.mode = 'entering';
    notify();
    const spot = doorSpot(info, Math.max(1.2, info.reach - 1.2));
    await control.flyTo({ target: new Vector3(spot.x, (info.focus?.y ?? 1.6) - 0.3, spot.z), radius: 4.2, beta: 1.25 }, 0.7);
    state.panelFor = id;
    state.mode = 'panel';
    notify();
    return true;
  };

  const back = async () => {
    if (!entering) return false;
    state.mode = 'returning';
    notify();
    const p = control.position();
    await control.flyTo({ target: new Vector3(p.x, p.y + 0.4, p.z), ...saved }, 0.6);
    control.releaseCamera();
    control.setEnabled(true);
    entering = false;
    state.panelFor = null;
    state.mode = 'explore';
    notify();
    return true;
  };

  // walking onto a door ring selects that building, glow eases toward the selected or nearby door
  function update(dt, t) {
    const p = control.position();
    let near = null;
    for (const info of infos) {
      const spot = doorSpot(info, info.reach);
      if (Math.hypot(spot.x - p.x, spot.z - p.z) < 2.1) near = info.id;
    }
    if (near !== state.nearDoor) {
      state.nearDoor = near;
      // one source of truth: walking onto a door selects it, unless an auto-walk is heading elsewhere
      if (!entering && near && (!control.isWalking() || near === state.selected)) state.selected = near;
      notify();
    }
    infos.forEach((info, i) => {
      const active = info.id === state.selected || info.id === state.nearDoor;
      const previous = glow.get(info.id);
      const value = previous + ((active ? 1 : 0) - previous) * Math.min(1, dt * 8);
      glow.set(info.id, value);
      const pulse = reduced() ? 0.9 : 0.85 + 0.15 * Math.sin(t * 4 + i);
      const alpha = 0.4 + 0.55 * value * pulse;
      if (Math.abs(value - previous) > 1e-4 || value > 0.01) {
        for (let v = 0; v < perDisc; v += 1) ringColors[(i * perDisc + v) * 4 + 3] = alpha;
        ringDirty = true;
      }
      onGlow?.(info.id, value, t);
    });
    if (ringDirty) {
      ringMesh.updateVerticesData(VertexBuffer.ColorKind, ringColors);
      ringDirty = false;
    }
  }

  return {
    select,
    enter,
    back,
    update,
    infoOf,
    isEntering: () => entering,
    dispose() {
      ownMaterial?.emissiveTexture?.dispose();
      ownMaterial?.dispose();
      ringMesh.dispose();
    },
  };
}
