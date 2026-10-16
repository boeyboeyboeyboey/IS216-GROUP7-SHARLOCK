# Capybara avatar presets

Boey requested these six presets on 14 October 2026 for AUTH-01-A. Generated with Codex's built-in image-generation tool, followed by a targeted edge-cleanup edit. These are new AI-generated raster assets; existing town SVGs and the navbar logo are preserved. Files retain their generated RGBA bytes and transparent backgrounds.

| ID          | Label      | File                           |
| ----------- | ---------- | ------------------------------ |
| `mint`      | Mint Scarf | [mint.png](mint.png)           |
| `blue`      | Blue Cap   | [blue.png](blue.png)           |
| `peach`     | Peach Bow  | [peach.png](peach.png)         |
| `detective` | Detective  | [detective.png](detective.png) |
| `reader`    | Reader     | [reader.png](reader.png)       |
| `gamer`     | Gamer      | [gamer.png](gamer.png)         |

The authoritative allowed IDs and labels live in [avatars.js](../../../../server/src/modules/auth/avatars.js). Registration accepts only these IDs. The account UI and avatar selection screen are a later approved slice; these assets do not imply that selection UI exists. Use square presentation and descriptive alternative text, following [DESIGN.md](../../../../DESIGN.md).

## Generation prompts

The first Mint Scarf image established the character and style. Each other avatar used that image as its style and identity reference.

### Mint Scarf

```text
Use case: stylized-concept
Asset type: preset profile avatar for Sharlock Hub
Primary request: a friendly capybara portrait wearing a mint-green scarf
Scene/backdrop: genuinely transparent background
Subject: one earthy-brown capybara head and shoulders, small rounded ears, broad cream muzzle, tiny dark eyes, gentle smile
Style/medium: crisp retro 2D pixel art with chunky square pixels, flat limited colors, dark earthy-green outlines, no antialiasing
Composition/framing: square canvas, centered front-facing head and shoulders, subject fills about 80 percent of canvas with clear empty margin, readable as a 64 to 96 pixel avatar
Color palette: warm brown fur, cream muzzle, earthy-green outline, mint scarf
Constraints: one character only; no text, logos, watermark, border, scenery, gradients, 3D shading or photorealism; retain true alpha transparency
```

### Blue Cap

```text
Use case: stylized-concept
Asset type: preset profile avatar for Sharlock Hub
Input image: reference for the capybara identity, pixel style, portrait scale, framing and fur palette
Primary request: create a matching capybara avatar wearing a soft muted-blue baseball cap
Subject: the same friendly earthy-brown capybara, small rounded ears, broad cream muzzle, tiny dark eyes and gentle smile as the reference
Style/medium: crisp retro 2D pixel art, chunky square pixels, limited flat palette and dark earthy-green outline; readable at 64 to 96 pixels
Composition/framing: square canvas with genuinely transparent background; centered front-facing head and shoulders; match the reference portrait proportions and scale
Constraints: replace the mint scarf with plain brown neck/shoulders and use only the requested accessory; keep the face identity, fur palette, pose and portrait composition consistent; no text, logos, watermark, frame, scenery, gradients, 3D rendering or photorealism
```

### Peach Bow

```text
Use case: stylized-concept
Asset type: preset profile avatar for Sharlock Hub
Input image: reference for the capybara identity, pixel style, portrait scale, framing and fur palette
Primary request: create a matching capybara avatar wearing a small peach-colored bow beside one ear
Subject: the same friendly earthy-brown capybara, small rounded ears, broad cream muzzle, tiny dark eyes and gentle smile as the reference
Style/medium: crisp retro 2D pixel art, chunky square pixels, limited flat palette and dark earthy-green outline; readable at 64 to 96 pixels
Composition/framing: square canvas with genuinely transparent background; centered front-facing head and shoulders; match the reference portrait proportions and scale
Constraints: replace the mint scarf with plain brown neck/shoulders and use only the requested accessory; keep the face identity, fur palette, pose and portrait composition consistent; no text, logos, watermark, frame, scenery, gradients, 3D rendering or photorealism
```

### Detective

```text
Use case: stylized-concept
Asset type: preset profile avatar for Sharlock Hub
Input image: reference for the capybara identity, pixel style, portrait scale, framing and fur palette
Primary request: create a matching capybara avatar wearing a beige detective deerstalker hat
Subject: the same friendly earthy-brown capybara, small rounded ears, broad cream muzzle, tiny dark eyes and gentle smile as the reference
Style/medium: crisp retro 2D pixel art, chunky square pixels, limited flat palette and dark earthy-green outline; readable at 64 to 96 pixels
Composition/framing: square canvas with genuinely transparent background; centered front-facing head and shoulders; match the reference portrait proportions and scale
Constraints: replace the mint scarf with plain brown neck/shoulders and use only the requested accessory; keep the face identity, fur palette, pose and portrait composition consistent; no text, logos, watermark, frame, scenery, gradients, 3D rendering or photorealism
```

### Reader

```text
Use case: stylized-concept
Asset type: preset profile avatar for Sharlock Hub
Input image: reference for the capybara identity, pixel style, portrait scale, framing and fur palette
Primary request: create a matching capybara avatar wearing amber-brown round reading glasses
Subject: the same friendly earthy-brown capybara, small rounded ears, broad cream muzzle, tiny dark eyes and gentle smile as the reference
Style/medium: crisp retro 2D pixel art, chunky square pixels, limited flat palette and dark earthy-green outline; readable at 64 to 96 pixels
Composition/framing: square canvas with genuinely transparent background; centered front-facing head and shoulders; match the reference portrait proportions and scale
Constraints: replace the mint scarf with plain brown neck/shoulders and use only the requested accessory; keep the face identity, fur palette, pose and portrait composition consistent; no text, logos, watermark, frame, scenery, gradients, 3D rendering or photorealism
```

### Gamer

```text
Use case: stylized-concept
Asset type: preset profile avatar for Sharlock Hub
Input image: reference for the capybara identity, pixel style, portrait scale, framing and fur palette
Primary request: create a matching capybara avatar wearing muted-lilac over-ear gaming headphones without a microphone
Subject: the same friendly earthy-brown capybara, small rounded ears, broad cream muzzle, tiny dark eyes and gentle smile as the reference
Style/medium: crisp retro 2D pixel art, chunky square pixels, limited flat palette and dark earthy-green outline; readable at 64 to 96 pixels
Composition/framing: square canvas with genuinely transparent background; centered front-facing head and shoulders; match the reference portrait proportions and scale
Constraints: replace the mint scarf with plain brown neck/shoulders and use only the requested accessory; keep the face identity, fur palette, pose and portrait composition consistent; no text, logos, watermark, frame, scenery, gradients, 3D rendering or photorealism
```

## Cleanup prompt

Each generated image was edited separately with this prompt; the Gamer edit named its lilac headphones explicitly while retaining the same constraints.

```text
Use case: precise-object-edit
Asset type: transparent preset avatar PNG
Primary request: clean only the stray saturated-red pixels along and below the bottom edge of this capybara avatar
Constraints: preserve the capybara identity, its current accessory, face, brown fur, pixel art, pose and canvas dimensions exactly; replace every isolated red artifact outside the character with fully transparent pixels, finish the bottom silhouette with the existing dark earthy-green outline, and leave a small clear transparent margin below it
Avoid: any red pixels, added objects, text, logos, frames or background; do not redesign or recolor the character
Output: retain genuine alpha transparency
```
