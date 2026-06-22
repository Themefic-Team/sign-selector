<template>
  <div ref="containerEl" class="sign-inner-layer" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Konva from 'konva'

const props = defineProps({
  shapeId: { type: String, default: 'rectangle' },
})

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  CUSTOMIZATION — all visual tuning in one place
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  // 1. Vignette — dark radial shadow from all edges inward
  VIGNETTE_ALPHA: 0.65,    // 0 = off  →  1 = solid black edge
  VIGNETTE_INNER: 0.42,    // 0–1: fraction of min-dimension where vignette starts

  // 2. Bottom-weight shadow — gravity/depth darkening at the lower edge
  BOTTOM_ALPHA:   0.45,    // 0 = off  →  0.6 = very heavy
  BOTTOM_HEIGHT:  0.55,    // 0–1: how far up the bottom shadow reaches

  // 3. Top-light wash — subtle brightening from top (overhead lighting)
  TOP_ALPHA:      0.10,    // 0 = off  →  0.20 = noticeable
  TOP_HEIGHT:     0.45,    // 0–1: how far down the top-light bleeds

  // 4. Gloss sheen — white radial glow at top-center (polished stone look)
  GLOSS_ALPHA:    0.16,    // 0 = off  →  0.30 = strong
  GLOSS_HEIGHT:   0.42,    // fraction of sign height covered by the sheen

  // 5. Specular highlight — thin bright stroke tracing the sign edge
  SPEC_ALPHA:     0.38,
  SPEC_INSET:     1.5,     // px from sign edge

  RECT_RADIUS:    6,
}

const containerEl = ref(null)
let stage      = null
let resizeObs  = null
let buildTimer = null

// Trace the sign outline onto a Canvas 2D context (used for Konva clipFunc)
function traceShape(ctx, W, H, inset = 0) {
  const x = inset, y = inset
  const w = Math.max(W - inset * 2, 1)
  const h = Math.max(H - inset * 2, 1)
  ctx.beginPath()
  switch (props.shapeId) {
    case 'oval':
    case 'oval_cottage':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'round':
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
      break
    case 'arched': {
      const ar = w / 2
      ctx.moveTo(x, y + h)
      ctx.lineTo(x, y + ar)
      ctx.arc(x + ar, y + ar, ar, Math.PI, 0)
      ctx.lineTo(x + w, y + h)
      ctx.closePath()
      break
    }
    default:
      ctx.roundRect(x, y, w, h, CFG.RECT_RADIUS)
  }
}

function buildScene() {
  if (!stage || !containerEl.value) return

  const W = containerEl.value.offsetWidth  || 300
  const H = containerEl.value.offsetHeight || 200

  stage.width(W)
  stage.height(H)
  stage.destroyChildren()

  const layer = new Konva.Layer()
  stage.add(layer)

  const cx = W / 2
  const cy = H / 2

  // All effects are clipped inside the sign boundary
  const group = new Konva.Group({
    clipFunc: (ctx) => traceShape(ctx, W, H, 0),
  })
  layer.add(group)

  // ── 1. Vignette — radial gradient, transparent center → dark edges ────────
  const vInner = Math.min(cx, cy) * CFG.VIGNETTE_INNER
  const vOuter = Math.hypot(cx, cy) * 1.05   // reach all corners

  group.add(new Konva.Rect({
    x: 0, y: 0, width: W, height: H,
    fillRadialGradientStartPoint:  { x: cx, y: cy },
    fillRadialGradientStartRadius: vInner,
    fillRadialGradientEndPoint:    { x: cx, y: cy },
    fillRadialGradientEndRadius:   vOuter,
    fillRadialGradientColorStops:  [
      0,   'rgba(0,0,0,0)',
      0.6, 'rgba(0,0,0,0)',
      1,   `rgba(0,0,0,${CFG.VIGNETTE_ALPHA})`,
    ],
  }))

  // ── 2. Bottom-weight shadow — dark linear gradient rising from bottom ──────
  group.add(new Konva.Rect({
    x: 0, y: 0, width: W, height: H,
    fillLinearGradientStartPoint: { x: 0, y: H },
    fillLinearGradientEndPoint:   { x: 0, y: H * (1 - CFG.BOTTOM_HEIGHT) },
    fillLinearGradientColorStops: [
      0, `rgba(0,0,0,${CFG.BOTTOM_ALPHA})`,
      1, 'rgba(0,0,0,0)',
    ],
  }))

  // ── 3. Top-light wash — subtle white gradient from the top ─────────────────
  group.add(new Konva.Rect({
    x: 0, y: 0, width: W, height: H,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint:   { x: 0, y: H * CFG.TOP_HEIGHT },
    fillLinearGradientColorStops: [
      0, `rgba(255,255,255,${CFG.TOP_ALPHA})`,
      1, 'rgba(255,255,255,0)',
    ],
  }))

  // ── 4. Gloss sheen — white radial glow at top-center ─────────────────────
  const gh   = H * CFG.GLOSS_HEIGHT
  const gcx  = cx
  const gcy  = gh * 0.45
  const gRad = Math.max(W * 0.52, gh * 0.75)

  group.add(new Konva.Ellipse({
    x: gcx, y: gcy,
    radiusX: W  * 0.48,
    radiusY: gh * 0.55,
    fillRadialGradientStartPoint:  { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndPoint:    { x: 0, y: 0 },
    fillRadialGradientEndRadius:   gRad,
    fillRadialGradientColorStops:  [
      0,    `rgba(255,255,255,${CFG.GLOSS_ALPHA})`,
      0.55, `rgba(255,255,255,${CFG.GLOSS_ALPHA * 0.3})`,
      1,    'rgba(255,255,255,0)',
    ],
  }))

  // ── 5. Specular highlight — thin bright stroke at the sign outline ─────────
  const si = CFG.SPEC_INSET
  const sw = W - si * 2
  const sh = H - si * 2
  const specProps = {
    stroke: `rgba(255,255,255,${CFG.SPEC_ALPHA})`,
    strokeWidth: 1.5,
    fill: null,
    listening: false,
  }

  switch (props.shapeId) {
    case 'oval':
    case 'oval_cottage':
      group.add(new Konva.Ellipse({ x: si + sw/2, y: si + sh/2, radiusX: sw/2, radiusY: sh/2, ...specProps }))
      break
    case 'round':
      group.add(new Konva.Circle({ x: si + sw/2, y: si + sh/2, radius: Math.min(sw,sh)/2, ...specProps }))
      break
    case 'arched':
      group.add(new Konva.Shape({
        ...specProps,
        sceneFunc(ctx, shape) {
          const ar = sw / 2
          ctx.beginPath()
          ctx.moveTo(si, si + sh)
          ctx.lineTo(si, si + ar)
          ctx.arc(si + ar, si + ar, ar, Math.PI, 0)
          ctx.lineTo(si + sw, si + sh)
          ctx.closePath()
          ctx.strokeShape(shape)
        },
      }))
      break
    default:
      group.add(new Konva.Rect({ x: si, y: si, width: sw, height: sh, cornerRadius: CFG.RECT_RADIUS, ...specProps }))
  }

  layer.draw()
}

function scheduleBuild() {
  clearTimeout(buildTimer)
  buildTimer = setTimeout(buildScene, 40)
}

onMounted(() => {
  const container = containerEl.value
  if (!container) return

  stage = new Konva.Stage({
    container,
    width:     container.offsetWidth  || 300,
    height:    container.offsetHeight || 200,
    listening: false,
  })

  resizeObs = new ResizeObserver(() => scheduleBuild())
  resizeObs.observe(container)
  buildScene()
})

watch(() => props.shapeId, scheduleBuild)

onUnmounted(() => {
  clearTimeout(buildTimer)
  resizeObs?.disconnect()
  if (stage) { stage.destroy(); stage = null }
})
</script>

<style scoped>
.sign-inner-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  border-radius: inherit;
}

.sign-inner-layer :deep(div) {
  pointer-events: none !important;
}
.sign-inner-layer :deep(canvas) {
  pointer-events: none !important;
  border-radius: inherit;
}
</style>
