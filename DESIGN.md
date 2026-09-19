# Sharlock design system

Read this alongside [TASKS.md](TASKS.md) and [agents.md](agents.md) before changing the portal or adding a game. Boey approved a global retro 2D pixel-art pivot in UI-04, using Pixelify Sans, the town's cream/earthy-green palette and existing pixel capybaras. This supersedes the earlier modern/pastel split. Keep the open-world town, direct building selection and accessible navigation. This file is the mandatory design contract for every teammate and AI agent adding shared UI. Individual games have the explicit design exception below; Task 3 hover-card refinement has been skipped.

## Global pixel aesthetic

| Surface                                                                 | Required aesthetic                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing, login/registration previews, profile, supporting pages and 404 | Retro 2D pixel art: square controls, dark borders, hard offset shadows, cream/green surfaces, pixel icons and pixel capybaras.                                                                                                                                                                                                    |
| Town entry (`/`; `/dashboard` redirects)                                | Original 2D top-down pixel town inspired by classic Pokémon-era towns, with buildings, trees, bushes, paths, pond and passive capybara cousins.                                                                                                                                                                                   |
| Shared navbar                                                           | The existing **3D-style monocle capybara logo** remains on every page, linking to `/`. Keep its 52px footprint and smooth rendering; do not pixelate or replace this asset. Display **Sharlock Hub** from 768px upward; below 768px hide the title and retain the logo/menu control. All navigation controls use the pixel theme. |
| Admin/log content                                                       | May use clean, functional styling and system typography. The current `/admin` preview opts into `meta.theme: 'utility'`; this changes presentation only. No working admin dashboard or log screen is implemented. The shared navbar retains its normal branding.                                                                  |
| Individual mini-games                                                   | May use their **own design philosophy**, including different fonts, colours, artwork, layouts and controls; pixel art is not required inside a game. Isolate all styling to the game module and preserve accessibility/responsiveness. The shared navbar, town building and metadata card keep the shared scheme.                 |

Within the shared website, the navbar is the only place that displays the 3D-style mascot. Use the original mint, blue and peach pixel capybaras on other shared pages, including landing, authentication previews, profile, contextual tips and 404. A game may choose its own artwork inside its module. The map contains pixel buildings/NPCs and metadata cards; do not replace it with a rounded activity-card grid. NPCs are passive scenery, with no walking avatar or movement prerequisite for entering a game.

## Rules for new pages and features

Treat the current implementation as the reference, not a loose mood board. Every new shared page, form, dialog, loading/error/empty state and navigation control must extend this scheme. Do not reintroduce the retired pastel/Inter design, rounded card system or a replacement shared theme through a feature implementation. The existing admin/log-content exception above remains valid.

| Reuse / inspect                                                                     | Responsibility                                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/assets/styles/main.css`                                                 | Exact shared palette, Pixelify Sans, square forms/buttons, hard shadows and focus styles. Use these variables/classes rather than copying colour literals or redefining tokens. |
| `client/src/layouts/PortalLayout.vue` and `client/src/components/portal/Navbar.vue` | Shared shell, retained 3D logo, title visibility, navigation, mobile offcanvas and focus handling. Do not build a competing header.                                             |
| `client/src/components/portal/`                                                     | Existing profile, progress, trophy, tip and connection-state components; reuse the appropriate component and its contract. Sample data remains labelled.                        |
| `client/src/assets/styles/town.css` and `client/src/components/town/PixelIcon.vue`  | Town layout/controls and original shared pixel icon vocabulary. Do not load a different icon style for shared UI.                                                               |
| `client/src/data/gameCatalog.js` and `client/src/components/town/`                  | Single building registration, shared metadata card, existing pan/zoom camera and audio. Follow the registration procedure below instead of duplicating them.                    |

Before coding an approved UI task, identify whether it is a shared page, permitted admin/log content or a game module. State which existing components/tokens will be reused and how new styles are contained. A generic Bootstrap component must receive the existing shared styling; framework defaults are not a new visual direction.

During review, compare shared surfaces with the current landing, profile and town; check 375/576/768/992/1200/1440px, breakpoint edges and landscape, keyboard/touch access, visible focus and no page-wide horizontal scrolling. Visit another shared page after leaving a game to check for style leakage. Do not redesign shared components as an incidental part of a game or feature; a requested change to the shared design needs its own explicit scope.

### Game design freedom and isolation

Game screens may choose their own visual language, typography, palette, artwork and layout. They are **not required to use the hub's pixel font, colours, square controls or pixel-art treatment**. Describe that choice in the game implementation plan without changing the shared design contract.

Keep game components/styles under `client/src/games/<game-id>/`. Use Vue `<style scoped>` or a module-specific root class, game-specific control classes and local variables such as `--game-*`. Assign game fonts and variables on that wrapper. Do not write game overrides against `:root`, `html`, `body`, `.portal-shell`, the navbar, shared root tokens or another module; avoid unscoped/deep selectors that escape the game. A component imported by a game must follow the same isolation rule.

The game's **town building, label, shared metadata card, shared navbar and any shared profile/progress/result UI** continue to use the hub scheme. Custom gameplay controls/feedback inside the game may use its own design. Its theme does not waive keyboard/touch access, readable controls, reduced-motion handling, 375px-and-up responsiveness, or shared authentication and result contracts. Never solve a layout problem by shrinking a desktop game board into an unreadable mobile image.

## Global palette

The following palette and typography rules apply to shared UI; game-local styling follows the exception above. The shared tokens live in `client/src/assets/styles/main.css`. Use variables so shared controls and the town remain consistent.

| Token                | Exact value                      | Use                                                 |
| -------------------- | -------------------------------- | --------------------------------------------------- |
| `--bg-primary`       | `#DFEAD6`                        | Application background.                             |
| `--accent-primary`   | `#A8C98A`                        | Green primary actions, progress and success.        |
| `--accent-secondary` | `#E3EACB`                        | Light green secondary surfaces/actions.             |
| `--text-main`        | `#334155`                        | Dark text and visible focus outlines.               |
| `--alert-warning`    | `#F5DFA6`                        | Warm warning/error backgrounds, with explicit text. |
| `--surface`          | `#FFF8DF`                        | Cream cards, navigation and forms.                  |
| `--border-strong`    | `#50634D`                        | Hard borders and offset shadows.                    |
| `--shadow-pixel`     | `4px 4px 0 var(--border-strong)` | Default hard shadow, without blur.                  |

Use dark text on light fills and 2–3px borders. Shared buttons, panels, avatars and badges have square corners. Button hover/pressed states shift the hard shadow slightly; reduced motion disables transitions. Warning/error meaning must also be stated in text. Bootstrap form/button/status styles use the shared palette.

`client/src/assets/styles/town.css` retains town-specific layout and interaction styles. Its shared root aliases are `--town-ink: var(--text-main)`, `--town-edge: var(--border-strong)`, `--town-paper: var(--surface)`, plus `--town-grass: #A8C98A`, `--town-grass-dark: #91B575`, `--town-sky: #DFEAD6` and `--town-gold: #996B24`. Earth/water colours belong to the original scenery assets. Game-specific colours must remain scoped inside that module.

## Typography, icons and artwork

- **Pixelify Sans** is imported once from Google Fonts in `main.css`, with `Courier New`/monospace fallback. Inter and Roboto are no longer used. Shared headings and activity-preview titles use **700**; shared body text uses **400**. Shared body text defaults to 18px with 1.5 line height; supporting page labels/actions use at least 16px. Town metadata retains its readable compact layout. Do not shrink text to fit a phone.
- Use the original grid-aligned `PixelIcon.vue` SVGs for shared controls, activity-preview symbols and trophies. Icons are decorative when adjacent text or a control label names the action. Preserve semantic labels and at least 44px primary touch targets.
- `client/public/images/sharlock-placeholder.svg` is the retained navbar illustration: a replaceable **3D-style SVG placeholder**, not a final 3D render. Keep descriptive alt text, explicit dimensions and `image-rendering: auto` on `.navbar-mascot`.
- Original pixel artwork lives in `client/public/images/town/`. Integer-grid SVG shapes use `shape-rendering="crispEdges"`; CSS uses `image-rendering: pixelated`. Preserve sprite proportions/footprints and descriptive alt text on meaningful images. Do not copy Pokémon sprites or branding.
- Decorative scenery and repeated NPCs are hidden from assistive technology; named building buttons provide actionable map content. No gameplay meaning may depend solely on colour, animation or scenery.
- Respect reduced motion. Artwork is static. Keep keyboard/touch alternatives to any pointer-based interaction and clean up listeners or animation work on departure.

## Town interaction and responsiveness

**Every game is available from the start.** There are no linear locks, unlock messages, grayscale unavailable nodes, or completion requirements. Difficulty and background knowledge help learners choose; neither gates access. Future server authentication and cohort permissions still apply independently of this learning sequence.

- `Dashboard.vue` displays the town introduction, pixel sample-profile summary and `TownMap.vue`. Desktop navigation sits in the header so the map can use the available width. On mobile the pixel profile/navigation also appears inside Bootstrap offcanvas.
- The town world is **1120 × 800 CSS pixels**, defined by `TOWN_SIZE` in `client/src/data/gameCatalog.js`. `Dashboard.vue` applies the `.town-canvas` boundary (maximum 1126px including its 3px borders). `TownMap.vue` uses **`@panzoom/panzoom` 4.6.2** for drag, pinch, focal zoom and containment; the viewport uses `overflow: clip` so transformed scenery cannot expand the page or introduce native focus scrolling. Keep the package instance and camera state local and dispose listeners/observers on departure. If the world changes size, update the dashboard canvas limit too.
- Buildings are semantic buttons in a list. **Hover or keyboard focus** shows details; **click/tap or Enter/Space** keeps the card open and moves focus to its title for preview activities. The approved newsstand exception opens the Times directly; hover/focus and Jump to retain its shared metadata card. A separate action in the card enters the activity. Escape or Close dismisses it and restores focus to the selected building.
- Every metadata card contains **Game Name**, **Description**, **Difficulty (exactly 1–3 stars)** and **Background Knowledge Needed** as a short list. A screen-reader label announces the numeric star rating. Cards remain inside the visible map frame, with internal scrolling when needed; touch users receive the same information as mouse users.
- **Drag/swipe** within the map to pan; pinch to zoom. Dedicated **− / + / Reset view** buttons and a zoom percentage sit outside the transformed world. Start at **100%**, allow up to **200%**, and change by 25 percentage points with the buttons; limit buttons are disabled. Never shrink below native size to fit a phone. Reset restores the initial camera; no camera preference persists. Pan/zoom is immediate, without motion tweening.
- Focus the viewport and use **arrow keys** to pan, **+ / −** to zoom and **0** to reset. The wheel/trackpad pans; Shift-wheel pans horizontally and Ctrl/Command-wheel zooms. **Jump to** centers any building and opens its card; keyboard focus also brings buildings into view. Touch users can scroll the page outside the canvas.
- Ignore the click generated after a drag/pinch; a fresh click/tap or Enter/Space still pins the card. Keep camera controls and metadata outside the scaled layer so text/control sizes remain stable. Card coordinates update after camera transforms and resizing. Preserve the pointer-focus protection for first taps.
- Offcanvas must trap focus, close with Escape/backdrop/Close, and restore focus. Resizing to desktop must remove the mobile backdrop and scroll lock.
- `ProfileWidget.vue`, `GlobalProgressBar.vue` and `TrophyCase.vue` remain available on pixel-styled profile/progress screens. Progress is informational and never controls building availability. Trophy badges wrap using flexbox.

### Current hover-card behavior — Task 3 skipped

Boey explicitly skipped Task 3 (UI-06) on 17 September 2026. Retain the existing clamped desktop placement and bottom overlay on narrow screens, synchronized with camera transforms. Do not add the proposed offset-card refinement automatically when registering a game or extending the town. Preserve card metadata, internal scrolling and focus restoration.

## Soundtrack

`TownAudio.vue` contains a standard HTML5 `<audio src="/audio/sharlock-bgm.mp3" loop muted preload="none">` using the existing `client/public/audio/sharlock-bgm.mp3` file. **Do not use `/public/` in the runtime URL.**

Audio starts muted and paused on every page load and every return to the town. There is no autoplay or saved unmuted preference. The visible pixel **Sound off / Sound on** button sits in the map toolbar's corner, outside the transformed world. Its first click unmutes and directly calls `play()` from the user gesture. Reflect success only when that promise resolves; if blocked or unavailable, return to muted and show a retry message. Muting pauses playback; leaving the town pauses and mutes it. Keep any asynchronous completion from updating an unmounted component.

## Adding a new game to the homepage

The six planned features are already registered. Keep their identities and placements when an implementation is explicitly authorized; a generic preview is existing work under the kickoff collision rules. These are shared town surfaces using the existing sprites, tokens, metadata card and camera.

| Feature                                 | Catalog ID / route suffix      | Building  | Position   | Readiness |
| --------------------------------------- | ------------------------------ | --------- | ---------- | --------- |
| CLI Cyber Defender                      | `cli-cyber-defender`           | cottage   | (112, 112) | Preview   |
| The Phishing Post-Mortem                | `phishing-post-mortem`         | library   | (480, 64)  | Preview   |
| SQL Injection Arcade                    | `sql-injection-arcade`         | hut       | (832, 128) | Preview   |
| Cyber News Central / The daily briefing | `threat-briefing`              | newsstand | (144, 480) | Complete  |
| LLM Social Engineering Simulator        | `social-engineering-simulator` | office    | (432, 520) | Preview   |
| Regex Defender                          | `regex-defender`               | shed      | (720, 496) | Preview   |

All routes use `/games/<catalog-id>`. The four retired illustrative URLs redirect: `integrity-detective` → `cli-cyber-defender`, `mini-ctf` → `sql-injection-arcade`, `access-control` → `social-engineering-simulator`, `red-blue` → `regex-defender`. They do not add entries or buildings.

1. **Read TASKS.md first.** Record the current contributor, branch, affected areas and next action. Coordinate changes to the shared catalog/router and read this design file.
2. Build the game inside its own module under `client/src/games/<game-id>/`. Choose its own design philosophy within the game-design exception above and keep its state/styles isolated. Its building and shared card still use the hub scheme. When implemented, wire a concrete local `/games/<game-id>` route in `client/src/router/index.js` to its entry component. The existing generic `/games/:gameId` route only shows honest development previews.
3. Reuse the existing entry for a listed feature. For a genuinely new feature, add an entry to **`gameCatalog` in `client/src/data/gameCatalog.js`**. This is the homepage's single frontend registration point. Required fields: stable unique kebab-case `id`, `name`, one-sentence `description`, integer `difficulty` **1, 2 or 3**, nonempty `backgroundKnowledge` string list, local `route`, and `building: { type, x, y }`. Keep `isPreview: true` until the route actually opens a playable implementation. Preview routes also use `duration` and `icon` (a supported `PixelIcon.vue` name, such as `shield`, `key`, `lock`, `news` or `trophy`).

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

4. **Add its building through that catalog entry.** `TownMap.vue` loops over the catalog to create the new button, sprite, label and shared `GameInfoCard.vue` automatically. Do not duplicate the card markup or add a second registration list. Available building types: **cottage, library, office, hut, shed, newsstand**. Coordinates are the top-left of a **192 × 200px** button footprint. Keep the whole footprint within `TOWN_SIZE`, clear of other buildings and important scenery. The example location is illustrative and overlaps the current office; choose a free location and adjust scenery before accepting any genuinely new feature. For a new sprite type, add `client/public/images/town/<type>.svg` and update `BUILDING_TYPES` in the catalog.
5. Adjust `TownScenery.vue` dirt paths, trees and bushes to connect the new entrance and keep its sign readable. If enlarging the town, update `TOWN_SIZE`, the scenery SVG dimensions/viewBox and path coordinates together. Do not shrink buildings or introduce completion locks to make space.
6. Verify the card's name, description, **1–3 star rating**, knowledge list and route for hover, focus and tap. The catalog validator rejects invalid ratings, missing knowledge, duplicate IDs, unsupported buildings and out-of-bounds placement. Run the relevant checks below and inspect the location visually for overlaps (the validator does not detect scenery collisions).
7. This catalog is **frontend display metadata only**. It grants no permissions, creates no attempts and awards no points. GAME-01 in TASKS.md tracks the pending authoritative registry/result contract. Coordinate its stable game ID, ruleset, learning objective, topic tags, server scoring and shared result validation when that contract is implemented. Never ship secret answers in frontend metadata.

## The Sharlock Times

The existing Daily briefing newsstand at `{ x: 144, y: 480 }` opens a cream pixel newspaper using the shared font, tokens, icons and original capybara. Its `/games/threat-briefing` route is a child of the persistent town route. Opening/closing the native dialog preserves the camera and town audio instance; town music pauses while the paper is open and resumes only when previously enabled; leaving the town still resets/disposes both. Close/Escape restores newsstand focus; a direct-link close returns to `/` without leaving the app.

News-owned styles stay under `.news-dialog` in the feature module. Desktop uses a lead story and two-column grid; narrow screens use a single column with internal scrolling and a sticky Close control. Mobile Browse & search starts collapsed so readers reach headlines sooner, while section buttons remain visible. Preserve keyboard access, safe publisher links, explicit cache/empty/error feedback and reduced motion. The official Guardian attribution logo retains its original rendering. The former landing content now belongs to the About feature, without changing the shared palette or shell.

Latest news and OWASP Top 10 use accessible tabs with arrow/Home/End focus movement and Enter/Space selection. The OWASP 2025 reference has numbered native disclosures, plain-language notes and explicit source/licence links, without Guardian branding. Preserve news filters when switching tabs; the reference sends no news request. The sticky top-right sound control remains visible next to Close at 375px; shorten decorative bar text on narrow screens before shrinking controls.

The supplied MP3 was renamed to remove the filename’s `#` for reliable static-file serving; the audio itself is unchanged. The newspaper’s supplied `/audio/Lo-fi_8-bit_coffee_s_1-1789752418868.mp3` is the explicitly authorized autoplay exception: attempt a 20%-volume loop on each opening, show a retryable Sound control if blocked, and stop on close/departure. Muting persists across newspaper tabs but not reopening; no persistent unmuted preference. Town BGM still begins muted on each town visit.

## Current implementation boundaries

The Daily briefing newsstand opens the live Times; the other five town buildings open the planned game previews. Cyber News Central is completed and accepted by Boey on 19 September 2026; those game implementations remain pending. `client/src/data/portalPreview.js` contains labelled illustrative profile/achievement data; it is not an authenticated session or saved learning record. The town is publicly reachable at `/`, with `/dashboard` redirecting there. AUTH-01/AUTH-02 remain pending. Do not claim the login screen, game previews, sample points or cohort access are working account features.

Reusable presentation contracts: `ProfileWidget` takes `username`, `title`, integer `points` and local `avatar`; `GlobalProgressBar` takes `completed`/`total` and clamps 0–100%; `TrophyCase` takes `{ id, name, description, icon }[]`; `SharlockTip` supports click/focus/hover and Escape.

## Verification and credits

Use `pnpm test:unit`, `pnpm test:e2e`, `pnpm lint`, `pnpm format:check` and `pnpm build` as appropriate. Verify 375, 576, 768, 992, 1200 and 1440px, 767/768px edges and landscape. Check bounded drag/pinch/wheel/keyboard panning, zoom limits/reset, drag-versus-click behavior, all buildings reachable at each zoom, card clipping/focus, mobile logo-only branding, offcanvas behaviour, default silence, actual MP3 playback after interaction, retry, route cleanup, and the pixel town/auth/profile/about/preview/404 pages. Verify the admin content exception separately. Keep actual results in TASKS.md.

The retained logo, pixel SVG illustrations, new capybara newsstand and pixel icons are original code-based artwork/placeholders. Times publisher attribution uses the official [Guardian Powered by logo](https://www.theguardian.com/open-platform/logos); article data comes from the [Guardian Open Platform](https://open-platform.theguardian.com/). Pixelify Sans uses the SIL Open Font License. [Panzoom](https://github.com/timmywil/panzoom) 4.6.2 supplies camera transforms/gestures under the MIT license. Phosphor remains an installed MIT-licensed dependency, but shared page templates now render the original pixel icons. The soundtrack file was supplied in the repository by Boey; its creator/license has not been supplied. Record its source and permission before including it in the final assessed asset credits.

References: [Bootstrap offcanvas](https://getbootstrap.com/docs/5.3/components/offcanvas/), [Phosphor Vue](https://github.com/phosphor-icons/vue), [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), [MDN media play promise](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [MDN pixel-art rendering](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look).

OWASP field notes adapt the [OWASP Top 10:2025](https://top10.owasp.org/2025/) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), with original fictional town examples. The newspaper lo-fi MP3 was supplied by Boey; its creator/license remains to be supplied for final assessed asset credits.
