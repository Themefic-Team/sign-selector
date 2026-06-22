<template>
  <canvas ref="canvasEl" class="pixi-sign-canvas" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Application, Sprite, Graphics, Container, Assets } from 'pixi.js'
import { DropShadowFilter } from 'pixi-filters'

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
const props = defineProps({
  /** Wall/surface background texture URL */
  surfaceImageUrl:  { type: String, default: '' },
  /** Slate stone texture URL (the outer border of the sign) */
  slateImageUrl:    { type: String, default: '' },
  /** Paint color texture URL (the engraved inner fill) */
  paintImageUrl:    { type: String, default: '' },
  /** Design template PNG URL (black design — engraved into paint via multiply) */
  templateImageUrl: { type: String, default: '' },
  /** Shape ID: 'rectangle' | 'oval' | 'oval_cottage' | 'round' | 'arched' */
  shapeId:          { type: String, default: 'rectangle' },
  /** Sign aspect ratio width unit (e.g. 10 for "10 x 13") */
  shapeAspectW:     { type: Number, default: 10 },
  /** Sign aspect ratio height unit (e.g. 13 for "10 x 13") */
  shapeAspectH:     { type: Number, default: 13 },
})

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  CUSTOMIZATION — change these values to tune the visual look
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  // Canvas size — must match the CSS size of .pixi-sign-canvas
  CANVAS_W: 385,
  CANVAS_H: 248,

  // Space between the canvas edge and the sign edge (in px)
  CANVAS_PADDING: 14,

  // Slate stone border thickness on each side of the sign (px)
  // Increase for a wider/chunkier stone frame
  SLATE_BORDER: 20,

  // ── Inner gold border lines ──────────────────────────────────────────────
  // Two thin decorative lines sit right at the inner edge of the slate.
  // GOLD_OUTER_DIST = how far the outer line extends INTO the slate from the paint boundary
  // GOLD_INNER_DIST = how far the inner line extends INTO the slate from the paint boundary
  // (outer > inner — outer line is closer to the slate edge)
  GOLD_COLOR:      0xc8a84e,   // gold/tan color  — change hex to alter line color
  GOLD_OUTER_DIST: 8,          // px into slate for the outer gold line
  GOLD_INNER_DIST: 3,          // px into slate for the inner gold line
  GOLD_THICKNESS:  2,          // stroke width of each line (px)

  // Corner radius for the 'rectangle' shape (px)
  RECT_RADIUS: 5,

  // ── Drop shadow (sign on wall) ───────────────────────────────────────────
  SHADOW_COLOR:    0x000000,
  SHADOW_ALPHA:    0.38,
  SHADOW_BLUR:     10,
  SHADOW_OFFSET_X: 2,
  SHADOW_OFFSET_Y: 6,

  // Fallback colors when a texture image fails to load
  FALLBACK_WALL_COLOR:  0xc8c4b4,   // light stone/beige wall
  FALLBACK_SLATE_COLOR: 0x2d3035,   // dark charcoal slate
  FALLBACK_PAINT_COLOR: 0xd4b87a,   // warm sand/ivory paint
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL STATE
// ─────────────────────────────────────────────────────────────────────────────
const canvasEl = ref(null)
let pixiApp    = null
let buildTimer = null   // debounce handle

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scale + position a sprite to COVER a target rect (like background-size: cover).
 * The sprite will be cropped if its aspect ratio doesn't match.
 */
function coverSprite(sprite, targetW, targetH, offsetX = 0, offsetY = 0) {
  const tw = sprite.texture.width  || 1
  const th = sprite.texture.height || 1
  const scale = Math.max(targetW / tw, targetH / th)
  sprite.scale.set(scale)
  sprite.x = offsetX + (targetW - tw * scale) / 2
  sprite.y = offsetY + (targetH - th * scale) / 2
}

/**
 * Scale + position a sprite to CONTAIN a target rect (like background-size: contain).
 * The sprite will be letterboxed if its aspect ratio doesn't match.
 */
function containSprite(sprite, targetW, targetH, offsetX = 0, offsetY = 0) {
  const tw = sprite.texture.width  || 1
  const th = sprite.texture.height || 1
  const scale = Math.min(targetW / tw, targetH / th)
  sprite.scale.set(scale)
  sprite.x = offsetX + (targetW - tw * scale) / 2
  sprite.y = offsetY + (targetH - th * scale) / 2
}

/**
 * Compute the sign's pixel dimensions so it fits inside the canvas while
 * maintaining the aspect ratio from props.shapeAspectW / shapeAspectH.
 * Returns { x, y, w, h } — the sign's position and size on the canvas.
 */
function computeSignRect() {
  const { CANVAS_W, CANVAS_H, CANVAS_PADDING } = CFG
  const maxW   = CANVAS_W - CANVAS_PADDING * 2
  const maxH   = CANVAS_H - CANVAS_PADDING * 2
  const ratio  = (props.shapeAspectW || 1) / (props.shapeAspectH || 1)

  let w, h
  if (ratio > maxW / maxH) {
    w = maxW
    h = maxW / ratio
  } else {
    h = maxH
    w = maxH * ratio
  }
  w = Math.round(w)
  h = Math.round(h)
  return {
    x: Math.round((CANVAS_W - w) / 2),
    y: Math.round((CANVAS_H - h) / 2),
    w,
    h,
  }
}

/**
 * Draw the correct shape path onto a Graphics object.
 * Does NOT call fill() or stroke() — the caller decides which to apply.
 *
 * @param {Graphics} g
 * @param {number}   x       top-left x of the bounding box
 * @param {number}   y       top-left y of the bounding box
 * @param {number}   w       width of the bounding box
 * @param {number}   h       height of the bounding box
 * @param {string}   shapeId one of: rectangle | oval | oval_cottage | round | arched
 * @param {number}   inset   shrink the shape inward by this many px on each side
 */
function drawShapePath(g, x, y, w, h, shapeId, inset = 0) {
  const ix = x + inset
  const iy = y + inset
  const iw = Math.max(w - inset * 2, 1)
  const ih = Math.max(h - inset * 2, 1)

  switch (shapeId) {

    case 'oval':
    case 'oval_cottage':
      // ellipse(centerX, centerY, halfWidth, halfHeight)
      g.ellipse(ix + iw / 2, iy + ih / 2, iw / 2, ih / 2)
      break

    case 'round':
      // circle(centerX, centerY, radius)
      g.circle(ix + iw / 2, iy + ih / 2, Math.min(iw, ih) / 2)
      break

    case 'arched': {
      // Top: semicircle arch.  Bottom: straight sides + flat bottom.
      // The arch radius equals half the width.
      const ar = iw / 2
      g.moveTo(ix,       iy + ih)       // bottom-left
      g.lineTo(ix,       iy + ar)       // left side up to arch start
      g.arc(ix + ar, iy + ar, ar, Math.PI, 0)  // arch (left to right across top)
      g.lineTo(ix + iw,  iy + ih)      // right side down to bottom-right
      g.closePath()                     // bottom edge back to start
      break
    }

    case 'rectangle':
    default:
      g.roundRect(ix, iy, iw, ih, CFG.RECT_RADIUS)
      break
  }
}

/** Load a texture from URL; returns null on empty URL or network error. */
async function safeLoad(url) {
  if (!url) return null
  try {
    return await Assets.load(url)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE BUILDER — called on mount and whenever props change
// ─────────────────────────────────────────────────────────────────────────────
async function buildScene() {
  if (!pixiApp) return

  // Remove every child from the stage (clean slate)
  pixiApp.stage.removeChildren()

  const { CANVAS_W, CANVAS_H, SLATE_BORDER,
          GOLD_COLOR, GOLD_OUTER_DIST, GOLD_INNER_DIST, GOLD_THICKNESS,
          SHADOW_COLOR, SHADOW_ALPHA, SHADOW_BLUR, SHADOW_OFFSET_X, SHADOW_OFFSET_Y,
          FALLBACK_WALL_COLOR, FALLBACK_SLATE_COLOR, FALLBACK_PAINT_COLOR } = CFG

  // ── Compute sign bounding rect ────────────────────────────────────────────
  const sign = computeSignRect()
  // The paint (engraved interior) is inset from the sign edge by SLATE_BORDER
  const paintInset = SLATE_BORDER

  // ── Load all textures in parallel ─────────────────────────────────────────
  const [surfaceTex, slateTex, paintTex, templateTex] = await Promise.all([
    safeLoad(props.surfaceImageUrl),
    safeLoad(props.slateImageUrl),
    safeLoad(props.paintImageUrl),
    safeLoad(props.templateImageUrl),
  ])

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1 — Wall / surface background
  // Fills the entire canvas behind the sign.
  // ══════════════════════════════════════════════════════════════════════════
  if (surfaceTex) {
    const wallSprite = new Sprite(surfaceTex)
    coverSprite(wallSprite, CANVAS_W, CANVAS_H)
    pixiApp.stage.addChild(wallSprite)
  } else {
    const wallBg = new Graphics()
    wallBg.rect(0, 0, CANVAS_W, CANVAS_H)
    wallBg.fill(FALLBACK_WALL_COLOR)
    pixiApp.stage.addChild(wallBg)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 2 — Sign container (receives the drop shadow filter)
  // ══════════════════════════════════════════════════════════════════════════
  const signContainer = new Container()
  signContainer.filters = [
    new DropShadowFilter({
      offset:   { x: SHADOW_OFFSET_X, y: SHADOW_OFFSET_Y },
      blur:     SHADOW_BLUR,
      color:    SHADOW_COLOR,
      alpha:    SHADOW_ALPHA,
      quality:  3,
    }),
  ]
  pixiApp.stage.addChild(signContainer)

  // ── LAYER 2a: Slate stone texture (masked to sign shape) ─────────────────
  // This is the outer stone border. The whole sign shape is filled with slate
  // texture; the paint area sits on top of it.
  const slateMask = new Graphics()
  drawShapePath(slateMask, sign.x, sign.y, sign.w, sign.h, props.shapeId)
  slateMask.fill(0xffffff)

  if (slateTex) {
    const slateSprite = new Sprite(slateTex)
    coverSprite(slateSprite, sign.w, sign.h, sign.x, sign.y)
    slateSprite.mask = slateMask
    signContainer.addChild(slateMask)
    signContainer.addChild(slateSprite)
  } else {
    // Fallback: draw a solid slate-coloured shape
    const slateFill = new Graphics()
    drawShapePath(slateFill, sign.x, sign.y, sign.w, sign.h, props.shapeId)
    slateFill.fill(FALLBACK_SLATE_COLOR)
    signContainer.addChild(slateFill)
  }

  // ── LAYER 2b: Paint area + template overlay ───────────────────────────────
  // A sub-container masked to the INNER area (sign minus the slate border).
  // Contains: paint texture + template PNG (multiply blend → engraved look).
  const paintMask = new Graphics()
  drawShapePath(paintMask, sign.x, sign.y, sign.w, sign.h, props.shapeId, paintInset)
  paintMask.fill(0xffffff)

  const paintContainer = new Container()
  paintContainer.mask = paintMask
  signContainer.addChild(paintMask)
  signContainer.addChild(paintContainer)

  // Paint texture — covers the entire inner area
  if (paintTex) {
    const paintSprite = new Sprite(paintTex)
    coverSprite(paintSprite, sign.w, sign.h, sign.x, sign.y)
    paintContainer.addChild(paintSprite)
  } else {
    const paintFill = new Graphics()
    drawShapePath(paintFill, sign.x, sign.y, sign.w, sign.h, props.shapeId, paintInset)
    paintFill.fill(FALLBACK_PAINT_COLOR)
    paintContainer.addChild(paintFill)
  }

  // Template overlay — black design engraved into paint via multiply blend mode.
  // White areas of the PNG stay transparent (paint shows through).
  // Black areas darken the paint to simulate stone carving.
  if (templateTex) {
    const tplSprite = new Sprite(templateTex)
    const paintW    = sign.w - paintInset * 2
    const paintH    = sign.h - paintInset * 2
    // Use contain-scaling so the whole template design is always visible
    containSprite(tplSprite, paintW, paintH, sign.x + paintInset, sign.y + paintInset)
    tplSprite.blendMode = 'multiply'
    paintContainer.addChild(tplSprite)
  }

  // ── LAYER 2c: Gold inner border lines ────────────────────────────────────
  // Two thin stroked lines around the paint boundary for the decorative inner frame.
  // They sit just inside the slate area, framing the paint.
  //
  //  |←── SLATE ──→|← outerLine →|gap|← innerLine →|← PAINT →|
  //
  const borderG = new Graphics()

  // Outer gold line (further into the slate from the paint edge)
  drawShapePath(borderG, sign.x, sign.y, sign.w, sign.h, props.shapeId,
                paintInset - GOLD_OUTER_DIST)
  borderG.stroke({ color: GOLD_COLOR, width: GOLD_THICKNESS, alpha: 0.95 })

  // Inner gold line (closer to the paint edge)
  drawShapePath(borderG, sign.x, sign.y, sign.w, sign.h, props.shapeId,
                paintInset - GOLD_INNER_DIST)
  borderG.stroke({ color: GOLD_COLOR, width: GOLD_THICKNESS, alpha: 0.95 })

  signContainer.addChild(borderG)
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCED REBUILD — avoids thrashing when multiple props change at once
// ─────────────────────────────────────────────────────────────────────────────
function scheduleBuild() {
  clearTimeout(buildTimer)
  buildTimer = setTimeout(() => buildScene(), 60)
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()

  pixiApp = new Application()
  await pixiApp.init({
    canvas:          canvasEl.value,
    width:           CFG.CANVAS_W,
    height:          CFG.CANVAS_H,
    backgroundAlpha: 0,            // transparent — wall sprite covers it
    antialias:       true,
    autoDensity:     true,
    resolution:      window.devicePixelRatio || 1,
  })

  await buildScene()
})

// Rebuild whenever any visual prop changes
watch(
  () => [
    props.surfaceImageUrl,
    props.slateImageUrl,
    props.paintImageUrl,
    props.templateImageUrl,
    props.shapeId,
    props.shapeAspectW,
    props.shapeAspectH,
  ],
  scheduleBuild,
)

onUnmounted(() => {
  clearTimeout(buildTimer)
  if (pixiApp) {
    pixiApp.destroy(true, { children: true, texture: false })
    pixiApp = null
  }
})
</script>

<style scoped>
.pixi-sign-canvas {
  display: block;
  width: 385px;
  height: 248px;
}
</style>
