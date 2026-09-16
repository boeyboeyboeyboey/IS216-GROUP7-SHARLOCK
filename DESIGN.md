# Sharlock design system

Read this alongside [TASKS.md](TASKS.md) and [agents.md](agents.md) before changing the portal or adding a game. Boey approved the open-world town pivot, direct click/tap building selection, and a bounded, scrollable map on mobile. These rules supersede the earlier linear pathway.

## Two visual worlds

| Surface                                                        | Required aesthetic                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing, login/registration, profile, supporting pages and 404 | Modern, soft pastel UI; rounded controls, soft shadows, clean Inter typography. Sharlock is a friendly **3D-styled capybara wearing a sleuthing monocle**.                                                                                                             |
| Student home (`/dashboard`)                                    | Original **2D top-down pixel-art town**, inspired by classic Pokémon-era towns. Pixel buildings, trees, bushes, dirt paths, pond, and passive friendly capybara cousin NPCs. Square pixel borders, hard offset shadows, pixel icons and retro metadata cards.          |
| Shared navbar                                                  | Always use the **3D capybara logo** linking to `/`. Show **Sharlock Hub** alongside it from Bootstrap MD (768px) upward. Below 768px hide the title completely, retaining the logo and mobile menu control. On the town page, navigation controls use the pixel theme. |
| Individual mini-games                                          | Independent scoped visual themes are welcome. Retain clean typography, soft/friendly aesthetics, accessible controls, and full responsiveness.                                                                                                                         |

The map contains **2D pixel capybaras only**. Do not put the 3D mascot, floating dimensional game icons, modern rounded cards, or a grid of activity cards inside the town. The navbar's 3D logo is the explicit exception. NPCs are passive scenery; there is no walking avatar or movement prerequisite for entering a game.

## Modern portal palette

Keep these exact `:root` variables in `client/src/assets/styles/main.css`. Use the variables instead of inventing replacement brand colours.

| Token                | Exact value | Use                                                          |
| -------------------- | ----------- | ------------------------------------------------------------ |
| `--bg-primary`       | `#F9FAFB`   | Off-white/alabaster application background.                  |
| `--accent-primary`   | `#A7F3D0`   | Mint primary buttons, progress bars, and success states.     |
| `--accent-secondary` | `#BAE6FD`   | Powder-blue secondary actions and modern decorative accents. |
| `--text-main`        | `#334155`   | Slate body text and headings instead of solid black.         |
| `--alert-warning`    | `#FFDAB9`   | Peach warning banners and error states.                      |

White surfaces and transparent shades/blends of the tokens provide borders and depth. Bootstrap button/status colours are overridden in the modern portal. Use slate text on pastel fills; white text on mint is not sufficiently legible. Always retain a visible dark focus ring.

The town's separate stylesheet, `client/src/assets/styles/town.css`, is scoped under `.is-town` and town component classes. Its local tokens are `--town-ink: #334155`, `--town-edge: #50634D`, `--town-paper: #FFF8DF`, `--town-grass: #A8C98A`, `--town-grass-dark: #91B575`, `--town-sky: #DFEAD6`, and `--town-gold: #996B24`. Earth/water colours belong to the original scenery assets. Never overwrite the modern `:root` palette to theme the town or a game.

## Typography, icons and artwork

- Modern pages import **Inter** from Google Fonts with a system sans-serif fallback. Roboto is the approved modern alternative. Headings (`h1`–`h6`) and game titles use **700**; body text uses **400** and defaults to slate.
- The town uses **Pixelify Sans**, with `Courier New`/monospace fallback. Keep the same 700/400 weight distinction, legible text, and at least 44px touch controls. Metadata must wrap naturally and remain readable at 375px.
- Modern pages use selectively imported, rounded **Phosphor Vue** icons, normally `duotone`. Town controls use the original grid-aligned `PixelIcon.vue` SVGs. Icons need accessible labels or accompanying text.
- The local modern SVG mascot is a replaceable **3D-style illustration placeholder**, not a final 3D render. Retain descriptive `<img alt>` text, dimensions and the `mascot-image` / `avatar-image` classes. Use it on landing/login, modern contextual tips and the 404 page.
- Original town assets live in `client/public/images/town/`. They use integer-grid SVG shapes with `shape-rendering="crispEdges"`; CSS sets `image-rendering: pixelated`. Future replacement pixel sprites must preserve their display footprint and clear silhouettes. Do not copy Pokémon sprites or branding.
- Decorative scenery and repeated NPCs are hidden from assistive technology; named building buttons provide the actionable map content. No gameplay meaning may depend solely on colour, animation or scenery.
- Respect reduced motion. The current town artwork is static; do not introduce mandatory motion, camera movement, or floating 3D art.

## Town interaction and responsiveness

**Every game is available from the start.** There are no linear locks, unlock messages, grayscale unavailable nodes, or completion requirements. Difficulty and background knowledge help learners choose; neither gates access. Future server authentication and cohort permissions still apply independently of this learning sequence.

- `Dashboard.vue` displays the town introduction, pixel sample-profile summary and `TownMap.vue`. Desktop navigation sits in the header so the map can use the available width. On mobile the pixel profile/navigation also appears inside Bootstrap offcanvas.
- The town world is **1120 × 800 CSS pixels**, defined by `TOWN_SIZE` in `client/src/data/gameCatalog.js`. Its viewport has a bounded responsive height and `overflow: auto`. Scroll/swipe inside it in both axes; the surrounding page must never scroll horizontally. Keep buildings readable instead of shrinking the whole town to fit a phone.
- Buildings are semantic buttons in a list. **Hover or keyboard focus** shows details; **click/tap or Enter/Space** keeps the card open and moves focus to its title. A separate action in the card enters the activity. Escape or Close dismisses it and restores focus to the selected building.
- Every metadata card contains **Game Name**, **Description**, **Difficulty (exactly 1–3 stars)** and **Background Knowledge Needed** as a short list. A screen-reader label announces the numeric star rating. Cards remain inside the visible map frame, with internal scrolling when needed; touch users receive the same information as mouse users.
- Focus the map viewport and use arrow keys to pan. The **Jump to** selector brings any building into view and opens its card. Preserve this alternative when expanding the world.
- Offcanvas must trap focus, close with Escape/backdrop/Close, and restore focus. Resizing to desktop must remove the mobile backdrop and scroll lock.
- `ProfileWidget.vue`, `GlobalProgressBar.vue` and `TrophyCase.vue` remain available on modern profile/progress screens. Progress is informational and never controls building availability. Trophy badges wrap using flexbox.

## Soundtrack

`TownAudio.vue` contains a standard HTML5 `<audio src="/audio/sharlock-bgm.mp3" loop muted preload="none">` using the existing `client/public/audio/sharlock-bgm.mp3` file. **Do not use `/public/` in the runtime URL.**

Audio starts muted and paused on every page load and every return to the town. There is no autoplay or saved unmuted preference. The visible pixel **Sound off / Sound on** button sits in the map toolbar's corner, outside the scrolling world. Its first click unmutes and directly calls `play()` from the user gesture. Reflect success only when that promise resolves; if blocked or unavailable, return to muted and show a retry message. Muting pauses playback; leaving the town pauses and mutes it. Keep any asynchronous completion from updating an unmounted component.

## Adding a new game to the homepage

1. **Read TASKS.md first.** Record the current contributor, branch, affected areas and next action. Coordinate changes to the shared catalog/router and read this design file.
2. Build the game inside its own module under `client/src/games/<game-id>/`. Keep its state/styles isolated. When implemented, wire a concrete local `/games/<game-id>` route in `client/src/router/index.js` to its entry component. The existing generic `/games/:gameId` route only shows honest development previews.
3. Add an entry to **`gameCatalog` in `client/src/data/gameCatalog.js`**. This is the homepage's single frontend registration point. Required fields: stable unique kebab-case `id`, `name`, one-sentence `description`, integer `difficulty` **1, 2 or 3**, nonempty `backgroundKnowledge` string list, local `route`, and `building: { type, x, y }`. Keep `isPreview: true` until the route actually opens a playable implementation. Preview routes also use `duration` and `icon` (one of the existing modern image placeholder names).

   Example entry for a proposed game (not already registered):

   ```js
   {
     id: 'certificate-inspector',
     name: 'Certificate inspector',
     description: 'Inspect a fictional certificate and decide whether to trust it.',
     difficulty: 2,
     backgroundKnowledge: ['Certificates', 'Trust and identity'],
     route: '/games/certificate-inspector',
     isPreview: true,
     duration: '6 min',
     icon: 'shield',
     building: { type: 'office', x: 400, y: 480 },
   }
   ```

4. **Add its building through that catalog entry.** `TownMap.vue` loops over the catalog to create the new button, sprite, label and shared `GameInfoCard.vue` automatically. Do not duplicate the card markup or add a second registration list. Available building types: **cottage, library, office, hut, shed**. Coordinates are the top-left of a **192 × 200px** button footprint. Keep the whole footprint within `TOWN_SIZE`, clear of other buildings and important scenery. The example location requires rearranging nearby scenery before acceptance. For a new sprite type, add `client/public/images/town/<type>.svg` and update `BUILDING_TYPES` in the catalog.
5. Adjust `TownScenery.vue` dirt paths, trees and bushes to connect the new entrance and keep its sign readable. If enlarging the town, update `TOWN_SIZE`, the scenery SVG dimensions/viewBox and path coordinates together. Do not shrink buildings or introduce completion locks to make space.
6. Verify the card's name, description, **1–3 star rating**, knowledge list and route for hover, focus and tap. The catalog validator rejects invalid ratings, missing knowledge, duplicate IDs, unsupported buildings and out-of-bounds placement. Run the relevant checks below and inspect the location visually for overlaps (the validator does not detect scenery collisions).
7. This catalog is **frontend display metadata only**. It grants no permissions, creates no attempts and awards no points. GAME-01 in TASKS.md tracks the pending authoritative registry/result contract. Coordinate its stable game ID, ruleset, learning objective, topic tags, server scoring and shared result validation when that contract is implemented. Never ship secret answers in frontend metadata.

## Current implementation boundaries

All five town buildings currently open activity previews. `client/src/data/portalPreview.js` contains labelled illustrative profile/achievement data; it is not an authenticated session or saved learning record. `/dashboard` is publicly reachable for design review until AUTH-01/AUTH-02 implement login and authorization. Do not claim the login screen, game previews, sample points or cohort access are working account features.

Reusable modern contracts: `ProfileWidget` takes `username`, `title`, integer `points` and local `avatar`; `GlobalProgressBar` takes `completed`/`total` and clamps 0–100%; `TrophyCase` takes `{ id, name, description, icon }[]`; `SharlockTip` supports click/focus/hover and Escape.

## Verification and credits

Use `pnpm test:unit`, `pnpm test:e2e`, `pnpm lint`, `pnpm format:check` and `pnpm build` as appropriate. Verify 375, 576, 768, 992, 1200 and 1440px, 767/768px edges and landscape. Check bounded map panning, all buildings reachable, card clipping/focus, mobile logo-only branding, offcanvas behaviour, default silence, actual MP3 playback after interaction, retry, route cleanup, and unchanged modern pages. Keep actual results in TASKS.md.

Modern and town SVG illustrations/icons are original code-based placeholders. Phosphor icons are MIT licensed; Inter and Pixelify Sans use the SIL Open Font License. The soundtrack file was supplied in the repository by Boey; its creator/license has not been supplied. Record its source and permission before including it in the final assessed asset credits.

References: [Bootstrap offcanvas](https://getbootstrap.com/docs/5.3/components/offcanvas/), [Phosphor Vue](https://github.com/phosphor-icons/vue), [Inter](https://fonts.google.com/specimen/Inter), [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), [MDN media play promise](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [MDN pixel-art rendering](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look).
