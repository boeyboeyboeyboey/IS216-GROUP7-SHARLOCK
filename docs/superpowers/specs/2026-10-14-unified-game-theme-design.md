# Unified game theme: town palette, realistic type

Status: design approved in chat on 2026-10-14 (Eric). Nothing is built yet. Next step is a plan (`superpowers:writing-plans`).

## Intent and why

The town and its pixel font set one look, then each game breaks from it: SHARMAIL (Phishing Post-Mortem) is blue and white, the Social Engineering Simulator is purple and white, and the CLI Cyber Defender is black and green. Eric's reaction was that moving between them feels jarring. The mismatch he named was the **colour and the sudden loss of the town's "bit" look**, and he likes the CLI theme and wants to keep it.

The goal is to make Phishing and Social Engineering feel like they belong to the same town without making them look like game props. Their realistic screens are deliberate (`DESIGN.md`, "Game design freedom and isolation": a spoofed sender only teaches when the inbox looks like an inbox), so the fix is a **softer contrast**, not a restyle.

## Decision

**Option B: town palette, realistic type.** In Phishing and Social Engineering, replace the blue and purple accents with the town's earthy green and cream. Keep each game's realistic layout and system font stack. The fonts, layouts, copy, behaviour, fit-to-window rules and verdict bar stay as they are.

Mockup shown to Eric (not saved in the repo): a window with a green title bar (`#a8c98a`, dark text), a thin green-grey border instead of a hard shadow, a selected row tinted `#e3eacb` with a dark-green edge, white content surfaces, dark-green primary buttons with white text, and the user's chat bubble in dark green.

## Goals

- Phishing and Social Engineering use the hub's colour tokens for accents, tints, borders and focus rings, so green and cream replace blue and purple.
- Realistic type stays: system font stack inside both games, including email and chat text.
- Every colour pairing stays accessible: text at 4.5:1 or better, large text and focus outlines at 3:1 or better, on the new backgrounds.
- The visible difference between hub and game is smaller but not zero: games keep a lighter, flatter, more realistic surface than the pixel hub.

## Non-goals

- No pixel font, hard shadows, square corners or pixel icons inside Phishing or Social Engineering. That is **Option C**, parked (see below).
- No change to the CLI Cyber Defender in this round (see "My calls").
- No change to the hub palette, shared navbar, town map or any shared component.
- No logic, API, scoring, copy, layout or test-ID changes.

## Anti-goals

- Success or failure signalled by green and red alone. The accent is now green, so "correct" (currently green) can read as just another accent. States must keep their text labels and keep a distinguishable colour or icon.
- Dark-green text or borders on green fills that fall below the contrast limits above.
- Leaking game colours into other pages, or game rules writing to `:root`, `html`, `body` or the shared shell.

## Constraints

- Game styles stay under each game's own folder and root class (`.phish-game`, `.soc-game`), with local `--game-*` variables, as `DESIGN.md` and `AGENTS.md` require. Take hub values from the existing root tokens (`--accent-primary #a8c98a`, `--accent-secondary #e3eacb`, `--surface #fff8df`, `--border-strong #50634d`, `--text-main #334155`) rather than copying hex values where the game CSS can read the token.
- Only the colour variables and the rules that hard-code the old accent change: `--game-accent`, `--game-accent-soft` and the places that use them in `client/src/games/phishing-post-mortem/phish.css` (blue `#1b64d1`, `#e8f0fd`) and `client/src/games/social-engineering-simulator/sim.css` (purple `#4338ca`, `#eceafe`).
- Both games belong to other contributors (Phishing: Athithya; Social Engineering: the contributor named in `TASKS.md`). Edit CSS variables only, and tell the owners.
- `DESIGN.md` must be updated in the same change so its Phishing paragraph no longer describes a blue accent, and the game-isolation section records that games share the town palette but keep realistic type.
- Keep the fit-to-window layout, the Phishing verdict bar and the existing e2e selectors unchanged.

## What is left to the builder

- The exact tints and which token each element maps to, within the goals and anti-goals above. Check contrast with real values; do not trust the mockup.
- How "correct" and "wrong" states stay distinct from the green accent (a darker success green, an icon or an outline are all fine).
- Whether the Phishing "spoof clue" fields (sender address, reply-to, link destination) need any extra emphasis. Not required for B; keep them readable.
- Visual review at 375, 576, 768, 992, 1200 and 1440px, then a visit to another page after leaving each game to confirm nothing leaked.

## My calls (Eric to confirm or overrule)

- **CLI unchanged.** Eric said he likes it and asked for "less jarring", and Option B was about the other two games. I decided the CLI keeps its black-and-green look this round. A later, separate step could soften its frame toward the town.
- **Social Engineering follows the same mapping as Phishing**, so the two read as a pair.
- **Type stays the system stack** in both games, which is what B means. Nothing is added to the games' fonts.

## Parked: Option C (all pixel, including content)

Considered and set aside for later, not rejected. Everything, even email and chat text, would use the town's pixel font and square, hard-shadow controls. Most unified, but it works against the games' realism. Two things to settle before anyone builds it:

1. **Lookalike senders.** Phishing clues depend on small differences such as `aurora-dynarnics` ("rn") against `aurora-dynamics` ("m"). Address, reply-to and link-destination fields would probably need a plain tinted monospace, which was shown to Eric and not decided.
2. **Cyrillic lookalikes.** Letters such as Cyrillic `а` (U+0430) are drawn the same as Latin `a` in any font, so no font choice fixes them. If the game ever teaches this, "Inspect destination" should flag non-Latin characters and show their names, optionally with the punycode form. Whether the pixel font has its own Cyrillic glyphs is unverified; if it does not, the browser substitutes another font for those letters, which would be an accidental clue.

## Done when

- Phishing and Social Engineering no longer show blue or purple accents in any state (briefing, play, debrief, error, focus).
- Contrast limits hold, checked with measured values.
- The page-fit measurements and the Phishing e2e specs still pass, and no style leaks to the town or About page after leaving a game.
- `DESIGN.md` and the `TASKS.md` review record describe the new palette and who must review.

## Side note: score display (not part of this change)

Phishing and Social Engineering show a score out of 100 although they are close to pass/fail, and a compromised Social Engineering result can still show 15/100. An outcome-first debrief was proposed and Eric deferred it; it is recorded in `DESIGN.md` as an open decision.
