import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createCapybaraRig } from './capybara.js';

// code built detective capybara (deerstalker, monocle, short cape), +z is forward, feet at y 0
export function createSharlock(scene, { reduced = () => false, toon = () => {} } = {}) {
  const root = new TransformNode('sharlock', scene);
  const rig = createCapybaraRig(scene, { name: 'sharlock', size: 1.55, reduced, toon });
  rig.node.parent = root;
  return { root, visual: rig.node, rig, label: null, meshes: rig.meshes, casters: rig.casters, tint: Color3.White() };
}
