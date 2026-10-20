# Legacy town (2D mode)

The pre-HUB-01 Panzoom pixel town. Since HUB-01 it is the **2D mode** on `/` and the automatic fallback when WebGL2 is missing or the 3D hub fails to start.

1. `Dashboard.vue` mounts either `HubScene` or `TownMap` (`v-if`), never both. `useTownMode.js` picks the mode.
2. The explicit 2D/3D choice is stored in `localStorage` key `sharlock.townMode`. A forced fallback is never stored.
3. Styles stay in the global `client/src/assets/styles/town.css`; its shell and dashboard rules are shared with the 3D landing.
4. `PixelIcon.vue` is shared and stays in `client/src/components/town/`.

Rollback:

1. Quick: in `Dashboard.vue`, make `useTownMode` default to `'2d'` (the `stored ?? '3d'` line in `resolveMode`).
2. Full: check out git tag `legacy-town-2026-10` (commit `f5f8995`) to restore the original town and Dashboard.

Owned files: `TownMap.vue`, `TownScenery.vue`, `TownAudio.vue`, `GameInfoCard.vue`, `useTownMode.js`, `__tests__/`.
