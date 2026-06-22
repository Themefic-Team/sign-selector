# PixiSignPreview — Customization Guide

File: `src/components/PixiSignPreview.vue`

This component uses **PixiJS v8** to render the realistic sign preview on a `<canvas>` element.
All visual tuning is done through a single `CFG` object at the top of the `<script setup>` block.

---

## Quick overview — what gets rendered

```
Canvas (385 × 248 px)
│
├─ Layer 1 ── Wall / surface background texture (cover-fills whole canvas)
│
└─ Layer 2 ── Sign container  ← drop shadow filter lives here
    │
    ├─ 2a  Slate texture   (masked to the sign shape)
    │
    ├─ 2b  Paint container (masked to the inner paint area)
    │       ├─ Paint texture   (cover-fills inner area)
    │       └─ Template PNG    (contain-scaled, blendMode: 'multiply' → engraved look)
    │
    └─ 2c  Gold border lines  (two thin stroked shapes around the paint boundary)
```

---

## The CFG object — all knobs in one place

```js
const CFG = {
  // ── Canvas size ──────────────────────────────────────────────────────────
  CANVAS_W: 385,          // must match the CSS width  of .pixi-sign-canvas
  CANVAS_H: 248,          // must match the CSS height of .pixi-sign-canvas

  // ── Gap between canvas edge and sign edge ────────────────────────────────
  CANVAS_PADDING: 14,     // increase = more breathing room around the sign

  // ── Slate border ─────────────────────────────────────────────────────────
  SLATE_BORDER: 20,       // px — width of the dark stone frame on each side
                          // increase for a thicker/chunkier frame

  // ── Gold inner border lines ──────────────────────────────────────────────
  GOLD_COLOR: 0xc8a84e,   // hex number — 0x followed by 6 hex digits
                          // e.g. 0xffd700 = pure gold, 0xc0c0c0 = silver
  GOLD_OUTER_DIST: 8,     // how far the OUTER line extends into the slate (px)
  GOLD_INNER_DIST: 3,     // how far the INNER line extends into the slate (px)
  GOLD_THICKNESS:  2,     // stroke width of each line (px)

  // ── Rectangle corner radius ──────────────────────────────────────────────
  RECT_RADIUS: 5,         // px — only affects 'rectangle' shaped signs

  // ── Drop shadow ──────────────────────────────────────────────────────────
  SHADOW_COLOR:    0x000000,  // shadow color (black)
  SHADOW_ALPHA:    0.38,      // shadow opacity  0 = invisible, 1 = solid
  SHADOW_BLUR:     10,        // blur radius — higher = softer/larger shadow
  SHADOW_OFFSET_X: 2,         // horizontal offset in px
  SHADOW_OFFSET_Y: 6,         // vertical offset in px (positive = down)

  // ── Fallback colors (shown when a texture URL fails to load) ────────────
  FALLBACK_WALL_COLOR:  0xc8c4b4,  // light beige wall
  FALLBACK_SLATE_COLOR: 0x2d3035,  // dark charcoal slate
  FALLBACK_PAINT_COLOR: 0xd4b87a,  // warm sand/ivory paint
}
```

---

## Common tweaks

### Make the sign bigger inside the canvas
Reduce `CANVAS_PADDING`:
```js
CANVAS_PADDING: 8,   // was 14
```

### Thinner stone frame (more paint area visible)
```js
SLATE_BORDER: 12,    // was 20
```

### Wider stone frame (more dramatic border)
```js
SLATE_BORDER: 28,
```

### Change gold lines to silver
```js
GOLD_COLOR: 0xb0b8c0,  // cool silver
```

### Single border line instead of two
Comment out the "outer gold line" block in `buildScene()`:
```js
// ─ outer gold line ─ (delete or comment these 2 lines to remove it)
drawShapePath(borderG, sign.x, sign.y, sign.w, sign.h, props.shapeId,
              paintInset - GOLD_OUTER_DIST)
borderG.stroke({ color: GOLD_COLOR, width: GOLD_THICKNESS, alpha: 0.95 })
```

### Stronger / softer drop shadow
```js
SHADOW_ALPHA: 0.55,   // stronger
SHADOW_BLUR:  18,     // softer edges
SHADOW_OFFSET_Y: 10, // lower
```

### No drop shadow at all
In `buildScene()`, find `signContainer.filters = [...]` and change to:
```js
signContainer.filters = []
```

### Resize the canvas
Change both the `CFG` values AND the CSS in `<style scoped>`:
```js
// CFG
CANVAS_W: 500,
CANVAS_H: 320,
```
```css
/* <style scoped> */
.pixi-sign-canvas {
  width:  500px;
  height: 320px;
}
```

---

## How blend modes work (engraving effect)

The template PNG (e.g. `01.png`) is drawn with `blendMode: 'multiply'`.

| Template pixel | Paint pixel  | Result              |
|---------------|--------------|---------------------|
| White `#fff`  | Any color    | Paint color shows   |
| Black `#000`  | Any color    | Near black (carved) |
| Gray `#888`   | Any color    | Darkened paint      |

So white areas of the template are "invisible" (paint shows through), and dark areas simulate stone carving. This is why the template PNGs must be **black designs on white or transparent backgrounds**.

---

## How shapes work

The `drawShapePath(g, x, y, w, h, shapeId, inset)` function draws the correct shape onto a `Graphics` object. After calling it, you call `.fill()` or `.stroke()` to fill or outline the shape.

Supported `shapeId` values:

| shapeId        | How it draws                                      |
|----------------|---------------------------------------------------|
| `rectangle`    | Rounded rectangle using `RECT_RADIUS`             |
| `oval`         | Ellipse fitted to the bounding box                |
| `oval_cottage` | Same as `oval`                                    |
| `round`        | Circle using the smaller of width/height          |
| `arched`       | Semicircle top + straight sides + flat bottom     |

To add a new shape, add a `case` in `drawShapePath()`:
```js
case 'diamond': {
  g.moveTo(ix + iw / 2, iy)         // top
  g.lineTo(ix + iw,     iy + ih / 2) // right
  g.lineTo(ix + iw / 2, iy + ih)    // bottom
  g.lineTo(ix,          iy + ih / 2) // left
  g.closePath()
  break
}
```

---

## Key PixiJS v8 API notes

| Task                         | Code                                              |
|------------------------------|---------------------------------------------------|
| Load a texture               | `await Assets.load(url)` → returns `Texture`      |
| Create a sprite              | `new Sprite(texture)`                             |
| Scale to cover               | `coverSprite(sprite, w, h, x, y)` (helper above) |
| Scale to contain             | `containSprite(sprite, w, h, x, y)` (helper above)|
| Blend mode multiply          | `sprite.blendMode = 'multiply'`                   |
| Mask a container             | `container.mask = graphicsObj` (add g to scene)  |
| Fill a shape                 | `g.roundRect(x,y,w,h,r)` then `g.fill(0xff0000)` |
| Stroke a shape               | `g.roundRect(x,y,w,h,r)` then `g.stroke({color, width})` |
| Drop shadow filter           | `new DropShadowFilter({ offset, blur, color, alpha })` |
| Destroy app on unmount       | `app.destroy(true, { children: true })`           |

---

## Troubleshooting

**Sign looks too small / too large**
→ Adjust `CANVAS_PADDING`. The sign auto-sizes to fit inside `(CANVAS_W - PADDING*2) × (CANVAS_H - PADDING*2)` while keeping the admin-set aspect ratio.

**Textures not loading (blank/fallback colors appear)**
→ Check browser console for CORS errors. Image URLs must be same-origin or served with `Access-Control-Allow-Origin: *`.

**Gold lines don't show / look wrong**
→ `GOLD_OUTER_DIST` must be less than `SLATE_BORDER`. If `GOLD_OUTER_DIST >= SLATE_BORDER` the line is outside the sign boundary and clipped by the slate mask.

**Drop shadow disappears**
→ The shadow is applied to the whole `signContainer`. If the sign fills the canvas completely, the shadow is clipped. Increase `CANVAS_PADDING` to give the shadow room.

**Template looks wrong shape (oval sign but template is rectangular)**
→ The template PNG is contained within the inner paint area. The paint mask already clips to the sign shape, so the template is automatically clipped to the correct shape.

**Page performance (multiple previews visible at once)**
→ Each `<PixiSignPreview>` creates its own WebGL context. Most browsers support 8–16 simultaneous WebGL contexts. This app shows one preview at a time (per step), so it is fine.
