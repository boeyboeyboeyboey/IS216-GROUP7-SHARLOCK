import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody.js';
import { PhysicsShapeBox, PhysicsShapeContainer } from '@babylonjs/core/Physics/v2/physicsShape.js';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { createFollowCamera, freeCamera } from './shared/camera.js';
import { clampAlpha, createDoors, doorSpot } from './shared/doors.js';
import { createInstrumentation } from './shared/instrumentation.js';
import { createPlayer } from './shared/player.js';
import { getTier } from './shared/quality.js';
import { createPlanarMirror } from './shared/mirror.js';
import { loadIndexes } from './shared/assets.js';
import { createSharlock } from './shared/sharlock.js';
import { createWorld } from './wharf/world.js';
import { createSigns } from './wharf/signs.js';
import { buildGround } from './wharf/ground.js';
import { buildDistrict } from './wharf/district.js';
import { buildLamps, buildCargo, buildNewsstand, buildCraneTower } from './wharf/props.js';
import { buildBridge } from './wharf/bridge.js';
import { buildSkyline } from './wharf/skyline.js';
import { createSky } from './wharf/sky.js';
import { createWater, waterClock } from './wharf/water.js';
import { buildBoats } from './wharf/boats.js';
import { buildLife } from './wharf/life.js';
import { setupLook } from './wharf/look.js';
import { applyToon } from './wharf/toon.js';
import { destinations, heightAt, obstacles, paths, spawn, walkable, waterY } from './wharf/layout.js';

export async function build({ engine, scene, canvas, state, notify, params, joystick, spawnAt = null }) {
  const tier = getTier(params);
  state.desktop = tier.desktop;
  state.tier = tier.name;
  const reduced = () => state.reducedMotion;
  const t0 = performance.now();
  const disposers = [];

  // higher three quarter follow view from the south, looking up the main street toward the river and the sun. close on sharlock
  // for wide screens, pulled back on tall ones so the street still fits
  // coming back from a game, stand just outside that door facing the street with the camera behind
  const returnTo = destinations.find((d) => d.id === spawnAt);
  const origin = returnTo ? { ...doorSpot(returnTo, returnTo.reach + 2.3), heading: returnTo.face } : { ...spawn, heading: 0 };
  const aspect = (canvas.clientWidth || 1440) / (canvas.clientHeight || 900);
  const camera = createFollowCamera({
    scene,
    canvas,
    spawn: origin,
    alpha: -Math.PI / 2 + 0.14,
    beta: 1.24,
    radius: aspect >= 1.45 ? 16 : 16 + (1.45 - aspect) * 15,
    fov: 0.95,
    far: 1400,
    limits: { radius: [9, 38], beta: [0.85, 1.4], spread: 0.9 },
  });
  if (returnTo) camera.alpha = clampAlpha(camera, Math.atan2(-Math.cos(returnTo.face), -Math.sin(returnTo.face)));
  const indexes = loadIndexes();
  const look = setupLook({ scene, camera, tier });
  disposers.push(() => look.dispose());

  // static district: every surface lands in a per-material batch, merged at the end
  const signs = createSigns(scene);
  const world = createWorld(scene, { signs });
  disposers.push(() => {
    world.dispose();
    signs.texture.dispose();
  });
  const ground = buildGround({ scene, world });
  const district = buildDistrict({ world, signs });
  const news = buildNewsstand({ world, signs, info: destinations.find((d) => d.id === 'threat-briefing'), B: district.B });
  const lamps = buildLamps({ scene, world, extraHeads: [...district.lampHeads, news.lamp], reduced });
  disposers.push(() => lamps.dispose());
  const cargo = buildCargo({ scene, world, barrels: district.crates.filter((c) => c.kind === 'barrel').map((c) => c.at) });
  buildCraneTower({ world });
  buildBridge({ world });
  const built = world.finish();
  look.cast(built.casters);
  for (const mesh of [...ground.meshes, ...cargo.meshes]) {
    mesh.receiveShadows = true;
    look.csm.addShadowCaster(mesh);
  }
  disposers.push(() => [...built.meshes, ...ground.meshes, ...cargo.meshes].forEach((m) => m.dispose()));

  // sky, river, far skyline, boats and street life
  const sky = createSky(scene, tier.desktop ? {} : { width: 1024, height: 256 });
  disposers.push(() => sky.dispose());
  const skyline = await buildSkyline({ scene, indexes, tier });
  disposers.push(() => skyline.dispose());
  const boats = buildBoats({ scene, world, tier, reduced });
  disposers.push(() => boats.dispose());
  const life = buildLife({ scene, world, tier, reduced, chimneys: district.chimneys });
  disposers.push(() => life.dispose());

  // planar reflection of boats, lamps, lit windows, skyline and the bridge, desktop only
  let mirror = null;
  if (tier.mirror) {
    const reflectKeys = ['brickRed', 'brickYellow', 'stone', 'slate', 'wash', 'plank', 'windowLit', 'bridgeStone', 'bridgeWash', 'bridgePlank', 'bridgeSlate'];
    const list = [...built.meshes.filter((m) => reflectKeys.some((k) => m.name === `static-${k}`)), ...skyline.meshes, ...boats.reflect, ...lamps.meshes.slice(0, 1)];
    mirror = createPlanarMirror(scene, { name: 'thames-mirror', y: waterY, ratio: tier.mirrorRatio, list });
    mirror.clearColor = new Color4(0, 0, 0, 0);
    // node materials do not register their render targets, so the scene is told to refresh it every frame
    scene.customRenderTargets.push(mirror);
    disposers.push(() => {
      scene.customRenderTargets.splice(scene.customRenderTargets.indexOf(mirror), 1);
      mirror.dispose();
    });
  }
  const water = createWater(scene, { mirror });
  disposers.push(() => {
    water.material.dispose();
    water.dispose();
  });

  // colliders: one big floor plus blocks for the kiosk, crates and benches
  const colliderNode = new TransformNode('colliders', scene);
  const compound = new PhysicsShapeContainer(scene);
  const box = (x, y, z, sx, sy, sz) => compound.addChild(new PhysicsShapeBox(new Vector3(x, y, z), Quaternion.Identity(), new Vector3(sx, sy, sz), scene));
  box(0, -0.5, 10, 220, 1, 220);
  for (const r of obstacles) box((r.x0 + r.x1) / 2, 1.3, (r.z0 + r.z1) / 2, r.x1 - r.x0, 2.6, r.z1 - r.z0);
  const colliderBody = new PhysicsBody(colliderNode, PhysicsMotionType.STATIC, false, scene);
  colliderBody.shape = compound;
  compound.material = { friction: 0.2, restitution: 0 };

  const sharlock = createSharlock(scene, { reduced, toon: (material) => applyToon(material, { rimGain: 1.2 }) });
  for (const mesh of sharlock.meshes) mesh.receiveShadows = true;
  for (const mesh of sharlock.casters) look.csm.addShadowCaster(mesh);
  const control = createPlayer({
    scene,
    engine,
    canvas,
    camera,
    ground: built.meshes.find((m) => m.name === 'static-cobble') ?? ground.meshes[0],
    sharlock,
    state,
    reduced,
    joystick,
    nav: { spawn: origin, heading: origin.heading, heightAt, walkable, paths, destinations, door: doorSpot },
  });

  const infos = destinations.map((d) => ({ ...d, focus: { x: d.x + Math.sin(d.face) * 1.5, y: d.building === 'newsstand' ? 1.5 : d.building === 'customs' ? 5.2 : d.building === 'police' ? 15 : 2.4, z: d.z + Math.cos(d.face) * 1.5 }, view: { radius: d.building === 'newsstand' ? 11 : d.building === 'customs' ? 17 : d.building === 'police' ? 32 : 15, beta: 1.12 } }));
  const doors = createDoors({ scene, state, notify, infos, control, camera, reduced, groundY: heightAt });

  // lower the player in the frame so the river and sky fill the top
  const frameOffset = -2.7;
  camera.targetScreenOffset.set(0, frameOffset);
  const metrics = createInstrumentation({ scene, state });
  const windowLit = world.materials.windowLit;
  const start = performance.now();
  const frame = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 1 / 20);
    const t = (performance.now() - start) / 1000;
    if (!state.paused) {
      control.update(dt);
      if (!reduced()) waterClock.time = t;
    }
    doors.update(dt, t);
    // lit windows warm up as the sun sets, lamps come on one by one
    const warm = reduced() ? 1 : Math.min(1, t / 24);
    windowLit.emissiveColor.set(0.5 + 0.5 * warm, 0.42 + 0.55 * warm, 0.36 + 0.55 * warm);
    lamps.update(t, dt);
    boats.update(dt);
    life.update(dt);
  });

  state.look = { mirror: Boolean(mirror), lamps: lamps.count, boats: true, tier: tier.name };
  state.buildMs = Math.round(performance.now() - t0);
  // an outside overlay can freeze walking and orbiting; coming back from a door must not undo that
  let inputPaused = false;
  const applyInput = () => {
    control.setEnabled(!inputPaused && !doors.isEntering());
    if (inputPaused) camera.detachControl();
    else camera.attachControl(canvas, true);
  };
  return {
    api: {
      select: doors.select,
      enter: doors.enter,
      back: async () => {
        const done = await doors.back();
        if (inputPaused) applyInput();
        return done;
      },
      setInputPaused: (value) => {
        inputPaused = Boolean(value);
        applyInput();
      },
      debug: {
        scene,
        teleport: (x, z) => control.teleport(x, z),
        position: () => control.position(),
        doors: () => infos.map((i) => ({ id: i.id, ...doorSpot(i, i.reach) })),
        camera: (alpha, beta, radius, tx, ty, tz, fov) => {
          control.releaseCamera();
          freeCamera(camera, alpha, beta, radius, tx === undefined ? null : [tx, ty, tz]);
          if (fov) camera.fov = fov;
          control.flyTo({}, 0.001);
        },
        cameraState: () => ({ target: camera.target.asArray(), alpha: camera.alpha, beta: camera.beta, radius: camera.radius }),
        walkTo: (x, z) => control.walkTo([[x, z]], { cancelHold: true }),
        clickAt: (cx, cy) => {
          const opts = { clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', bubbles: true, isPrimary: true };
          canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
          canvas.dispatchEvent(new PointerEvent('pointerup', opts));
        },
        sharlockStats: () => ({ triangles: control.player.rig?.triangles() ?? 0, meshes: control.player.rig?.drawCalls() ?? 0 }),
        lampsLit: () => lamps.litFraction(),
        cab: () => life.cabAt(),
        worker: (i) => life.workerAt(i),
        sunClock: () => (performance.now() - start) / 1000,
      },
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(frame);
      metrics.dispose();
      doors.dispose();
      control.dispose();
      camera.detachControl();
      colliderBody.dispose();
      for (const fn of disposers.reverse()) fn();
    },
  };
}
