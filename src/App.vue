<script setup>
import { computed, ref } from 'vue'
import { useSignSelectorState } from './useSignSelectorState'

const {
  stepDefinitions,
  hasSection,
  totalSteps,
  state,
  signStyles,
  installationSurfaces,
  shapes,
  slateColors,
  designTemplates,
  paintColors,
  addOns,
  mountingHardware,
  selectedSignStyle,
  selectedSurface,
  selectedShape,
  selectedSlateColor,
  selectedTemplate,
  selectedPaintColor,
  selectedAddOn,
  selectedHardware,
  totalPrice,
  payload,
  preview,
  isFirstStep,
  isLastStep,
  setStep,
  nextStep,
  prevStep,
  submitConfiguration
} = useSignSelectorState()

const formattedPayload = computed(() => JSON.stringify(payload.value, null, 2))

const formatOptionLabel = (label) => label.replace(/\s*\((\+)?\$\d+\)\s*$/i, '')

const activeTier = ref('Deluxe')
const tieredTemplates = computed(() => designTemplates.filter(t => t.tier === activeTier.value))
const hasTiers = computed(() => designTemplates.some(t => t.tier === 'Deluxe') || designTemplates.some(t => t.tier === 'Standard'))

const templateImageUrl = computed(() => {
  const tpl = selectedTemplate.value
  if (!tpl) return ''
  return tpl.images?.[selectedShape.value?.id] || tpl.imageUrl || ''
})

const getAspectRatio = (shape) => {
  if (!shape?.width || !shape?.height) {
    return '1 / 1'
  }

  return `${shape.width} / ${shape.height}`
}

const getShapeCardStyle = (shape) => ({
  aspectRatio: getAspectRatio(shape),
  width: shape?.id === 'round' ? '58px' : '100%',
  height: 'auto',
  marginInline: 'auto'
})

const getSlateChipStyle = (shape, imageUrl) => ({
  backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  aspectRatio: getAspectRatio(shape),
  width: shape?.id === 'round' ? '62px' : '100%',
  height: 'auto',
  marginInline: shape?.id === 'round' ? 'auto' : '0'
})

const getPreviewShapeStyle = (shape) => ({
  aspectRatio: getAspectRatio(shape),
  width: shape?.id === 'round' ? 'min(100%, 172px)' : shape?.id === 'oval' ? 'min(100%, 210px)' : 'min(100%, 240px)',
  minHeight: 'auto'
})

const onSubmit = async () => {
  let previewImageDataUrl = ''
  let previewImageName = ''

  try {
    // Load an image cross-origin, resolves null silently on failure
    const loadImg = (url) =>
      new Promise((resolve) => {
        if (!url) return resolve(null)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        // cache-bust to avoid stale CORS preflight blocks
        img.src = url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now()
      })

    const CW = 800
    const CH = 520
    const canvas = document.createElement('canvas')
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')

    // ── 1. Surface background ──────────────────────────
    const surfaceImg = await loadImg(selectedSurface.value.imageUrl)
    if (surfaceImg) {
      ctx.drawImage(surfaceImg, 0, 0, CW, CH)
    } else {
      ctx.fillStyle = '#d9c9a8'
      ctx.fillRect(0, 0, CW, CH)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fillRect(0, 0, CW, CH)

    // ── 2. Sign dimensions ────────────────────────────
    const shape = selectedShape.value
    const shapeId = shape.id
    const ratio = shape.width && shape.height ? shape.width / shape.height : 1
    const isRound = shapeId === 'round'
    const isOval = shapeId === 'oval'
    const isArch = shapeId === 'arch'

    let signW, signH
    if (isRound) {
      const d = Math.round(Math.min(CW, CH) * 0.52)
      signW = d
      signH = d
    } else if (isOval) {
      signW = Math.round(CW * 0.60)
      signH = Math.round(signW / ratio)
    } else {
      // rectangle or arch
      signW = Math.round(CW * 0.40)
      signH = Math.round(signW / ratio)
    }

    // clamp so sign never overflows canvas
    if (signH > CH * 0.84) {
      signH = Math.round(CH * 0.84)
      signW = Math.round(signH * ratio)
    }

    const sx = Math.round((CW - signW) / 2)
    const sy = Math.round((CH - signH) / 2)
    const cx = sx + signW / 2
    const cy = sy + signH / 2

    // ── 3. Reusable shape path builder ───────────────
    const shapePath = () => {
      ctx.beginPath()
      if (isRound) {
        ctx.arc(cx, cy, signW / 2, 0, Math.PI * 2)
      } else if (isOval) {
        ctx.ellipse(cx, cy, signW / 2, signH / 2, 0, 0, Math.PI * 2)
      } else if (isArch) {
        // Flat bottom with rounded dome top (matches UI preview)
        const shoulderY = sy + signH * 0.56
        ctx.moveTo(sx, sy + signH)
        ctx.lineTo(sx, shoulderY)
        ctx.quadraticCurveTo(sx, sy, cx, sy)
        ctx.quadraticCurveTo(sx + signW, sy, sx + signW, shoulderY)
        ctx.lineTo(sx + signW, sy + signH)
        ctx.lineTo(sx, sy + signH)
      } else {
        // rectangle
        const r = 12
        ctx.moveTo(sx + r, sy)
        ctx.lineTo(sx + signW - r, sy)
        ctx.arcTo(sx + signW, sy, sx + signW, sy + r, r)
        ctx.lineTo(sx + signW, sy + signH - r)
        ctx.arcTo(sx + signW, sy + signH, sx + signW - r, sy + signH, r)
        ctx.lineTo(sx + r, sy + signH)
        ctx.arcTo(sx, sy + signH, sx, sy + signH - r, r)
        ctx.lineTo(sx, sy + r)
        ctx.arcTo(sx, sy, sx + r, sy, r)
      }
      ctx.closePath()
    }

    // ── 4. Draw sign fill + slate texture ────────────
    ctx.save()
    shapePath()
    ctx.clip()

    // solid slate base color
    ctx.fillStyle = '#2b3239'
    ctx.fillRect(sx - 1, sy - 1, signW + 2, signH + 2)

    // Use the base slate texture image for export to avoid artifacts in pre-cut shape assets.
    const slateImgUrl = selectedSlateColor.value.imageUrl
    const slateImg = await loadImg(slateImgUrl)
    if (slateImg) {
      ctx.globalAlpha = 0.9
      ctx.drawImage(slateImg, sx, sy, signW, signH)
      ctx.globalAlpha = 1
    }

    // subtle dark overlay (matches CSS gradient overlay)
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fillRect(sx - 1, sy - 1, signW + 2, signH + 2)

    ctx.restore()

    // ── 5. Sign border ────────────────────────────────
    ctx.save()
    shapePath()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // ── 6. Text (clipped inside sign) ────────────────
    const paintHex = selectedPaintColor.value.hex || '#f2f4ef'
    const paintTextureImg = await loadImg(selectedPaintColor.value.imageUrl)
    const houseText = String(state.houseNumber || '183')
    const streetText = String(state.bottomText || '').toUpperCase()

    const numSize = Math.round(Math.min(signH * 0.38, signW * 0.30))
    const streetSize = Math.round(numSize * 0.28)

    ctx.save()
    shapePath()
    ctx.clip()
    ctx.fillStyle = paintHex
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'

    ctx.font = `bold ${numSize}px Georgia, "Times New Roman", serif`
    const lineSpacing = streetText ? numSize * 0.08 : 0
    const totalTextH = streetText ? numSize + lineSpacing + streetSize : numSize
    const textStartY = cy - totalTextH / 2 + numSize

    const drawTextWithPaint = (text, font, x, y) => {
      if (!text) return

      if (!paintTextureImg) {
        ctx.fillStyle = paintHex
        ctx.font = font
        ctx.fillText(text, x, y)
        return
      }

      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = CW
      maskCanvas.height = CH
      const maskCtx = maskCanvas.getContext('2d')

      maskCtx.textAlign = 'center'
      maskCtx.textBaseline = 'alphabetic'
      maskCtx.font = font
      maskCtx.fillStyle = '#fff'
      maskCtx.fillText(text, x, y)

      // Keep paint texture inside text glyphs.
      maskCtx.globalCompositeOperation = 'source-in'
      maskCtx.drawImage(paintTextureImg, sx, sy, signW, signH)

      ctx.drawImage(maskCanvas, 0, 0)
    }

    drawTextWithPaint(houseText, `bold ${numSize}px Georgia, "Times New Roman", serif`, cx, textStartY)

    if (streetText) {
      drawTextWithPaint(streetText, `${streetSize}px Georgia, "Times New Roman", serif`, cx, textStartY + lineSpacing + streetSize + 4)
    }

    ctx.restore()

    previewImageDataUrl = canvas.toDataURL('image/png', 0.92)
    previewImageName = `sign-preview-${Date.now()}.png`
  } catch (err) {
    console.warn('Preview capture failed:', err)
  }

  await submitConfiguration({ previewImageDataUrl, previewImageName })
}
</script>

<template>
  <section class="selector-root">
    <div class="tf-selector-shell">
      <ul class="tf-stepper" aria-label="Sign setup steps">
        <li
          v-for="(sd, idx) in stepDefinitions"
          :key="sd.id || idx"
          class="tf-step-item"
          :class="{
            active: state.currentStep === idx + 1,
            complete: state.currentStep > idx + 1
          }"
        >
          <button type="button" class="tf-step-btn" @click="setStep(idx + 1)">
            <span class="tf-dot" />
            <span class="tf-label">{{ sd.title }}</span>
          </button>
        </li>
      </ul>

      <header class="hero">
        <h2>{{ stepDefinitions[state.currentStep - 1]?.heading || stepDefinitions[state.currentStep - 1]?.title }}</h2>
        <p>{{ stepDefinitions[state.currentStep - 1]?.subheading || '' }}</p>
      </header>

      <!-- ═══ Step 1: Select Sign Style (always) ═══ -->
      <div v-if="state.currentStep === 1" class="step-grid card-grid-2">
        <button
          v-for="item in signStyles"
          :key="item.id"
          type="button"
          class="choice-card"
          :aria-pressed="state.signStyleId === item.id"
          :class="{ selected: state.signStyleId === item.id }"
          @click="state.signStyleId = item.id"
        >
          <span class="choice-icon">
            <img v-if="item.iconUrl" :src="item.iconUrl" :alt="item.label" class="choice-icon-img" />
            <span v-else-if="item.icon && item.icon.trim().startsWith('<')" class="choice-icon-svg" v-html="item.icon" />
            <span v-else>{{ item.icon }}</span>
          </span>
          <span class="choice-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <span v-if="state.signStyleId === item.id" class="choice-selected-indicator" aria-hidden="true" />
        </button>
      </div>

      <!-- ═══ Step 2: Shape, Size & Slate ═══ -->
      <div v-if="state.currentStep === 2" class="split-layout">
        <div class="panel-stack">
          <!-- Installation Surface (flow-dependent) -->
          <section v-if="hasSection('installation-surface')" class="panel installation-panel">
            <h3 class="installation-title">
              Installation Surface
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <div class="surface-scroller">
              <div class="pill-grid surface-grid">
                <button
                  v-for="item in installationSurfaces"
                  :key="item.id"
                  type="button"
                  class="tile surface-tile"
                  :aria-label="item.label"
                  :class="{ selected: state.surfaceId === item.id }"
                  @click="state.surfaceId = item.id"
                >
                  <span class="surface-thumb" :style="{ backgroundImage: `url(${item.imageUrl})` }" />
                  <span class="sr-only">{{ item.label }}</span>
                  <span v-if="state.surfaceId === item.id" class="surface-check" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <!-- Size & Shape (flow-dependent) -->
          <section v-if="hasSection('size-shape')" class="panel size-panel">
            <h3 class="panel-title-with-info">
              Size & Shape
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <div class="shape-grid">
              <button
                v-for="item in shapes"
                :key="item.id"
                type="button"
                class="tile shape-card"
                :class="{ selected: state.shapeId === item.id }"
                @click="state.shapeId = item.id"
              >
                <span class="shape-preview" :class="item.id" :style="getShapeCardStyle(item)">
                  <span class="shape-dim">{{ item.label }}</span>
                </span>
                <small class="shape-price">${{ item.basePrice.toFixed(2) }}</small>
                <span v-if="state.shapeId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <!-- Slate Color (flow-dependent) -->
          <section v-if="hasSection('slate-color')" class="panel slate-panel">
            <h3 class="panel-title-with-info">
              Slate Color
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <div class="swatch-grid slate-grid">
              <button
                v-for="item in slateColors"
                :key="item.id"
                type="button"
                class="swatch slate-card"
                :class="{ selected: state.slateColorId === item.id }"
                @click="state.slateColorId = item.id"
              >
                <span
                  class="swatch-chip slate-chip"
                  :class="selectedShape.id"
                  :style="getSlateChipStyle(
                    selectedShape,
                    item.images?.[selectedShape.id] || item.imageUrl
                  )"
                />
                <span class="slate-label">{{ item.label }}</span>
                <small class="slate-price">${{ item.price.toFixed(2) }}</small>
                <span v-if="state.slateColorId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <div class="footer-actions" v-if="state.currentStep > 1">
            <button type="button" class="ghost-btn" :disabled="isFirstStep" @click="prevStep">Back</button>
            <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
            <button v-if="!isLastStep" type="button" class="tf-primary-btn" @click="nextStep">Continue</button>
            <button v-else type="button" class="tf-primary-btn" @click="onSubmit">Add to Cart</button>
          </div>
        </div>

        <aside class="preview-card">
          <header>
            <div class="apple-cion">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#FF6467"/>
              </svg>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#FDC700"/>
              </svg>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#05DF72"/>
              </svg>
            </div>
            <span>Your Custom Sign</span>
          </header>
          <div class="preview-canvas" :style="preview.surfaceStyle">
            <div class="preview-sign" :class="selectedShape.id" :style="[preview.signStyle, getPreviewShapeStyle(selectedShape)]">
              <!-- <span class="preview-number" :style="preview.textStyle">{{ state.houseNumber || '183' }}</span>
              <span class="preview-street" :style="preview.textStyle">{{ state.bottomText || 'EAST STREET' }}</span> -->
            </div>
          </div>
          <ul class="spec-list">
            <li><span>Type</span><strong>{{ selectedSignStyle.label }}</strong></li>
            <li><span>Shape</span><strong>{{ selectedShape.label }}</strong></li>
            <li><span>Slate</span><strong>{{ selectedSlateColor.label }}</strong></li>
            <li><span>Total</span><strong>${{ totalPrice.toFixed(2) }}</strong></li>
          </ul>
        </aside>
      </div>

      <!-- ═══ Step 3: Design & Finish ═══ -->
      <div v-if="state.currentStep === 3" class="split-layout">
        <div class="panel-stack">
          <!-- Design Template (flow-dependent) -->
          <section v-if="hasSection('design-template')" class="panel">
            <div class="design-template-header">
              <h3 class="panel-title-with-info">
              Select Design Template
                <span class="info-dot" aria-hidden="true">i</span>
              </h3>

              <!-- Tier tabs -->
              <div v-if="hasTiers" class="tier-tabs">
                <button
                  type="button"
                  class="tier-tab"
                  :class="{ active: activeTier === 'Deluxe' }"
                  @click="activeTier = 'Deluxe'"
                >Deluxe</button>
                <button
                  type="button"
                  class="tier-tab"
                  :class="{ active: activeTier === 'Standard' }"
                  @click="activeTier = 'Standard'"
                >Standard</button>
              </div>
            </div>

            <!-- Filtered templates by active tier -->
            <div v-if="hasTiers" class="pill-grid template-grid">
              <button
                v-for="item in tieredTemplates"
                :key="item.id"
                type="button"
                class="tile template-tile"
                :class="{ selected: state.templateId === item.id }"
                @click="state.templateId = item.id"
              >
                <img v-if="item.images?.[selectedShape.id] || item.imageUrl" :src="item.images?.[selectedShape.id] || item.imageUrl" :alt="item.label" class="template-thumb" />
                 
                <span v-if="state.templateId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>

            <!-- Fallback: templates without tier grouping -->
            <div v-if="!hasTiers" class="pill-grid template-grid">
              <button
                v-for="item in designTemplates"
                :key="item.id"
                type="button"
                class="tile template-tile"
                :class="{ selected: state.templateId === item.id }"
                @click="state.templateId = item.id"
              >
                <img v-if="item.images?.[selectedShape.id] || item.imageUrl" :src="item.images?.[selectedShape.id] || item.imageUrl" :alt="item.label" class="template-thumb" />
                <span>{{ item.label }}</span>
              </button>
            </div>
          </section>

          <!-- Paint Color (flow-dependent) -->
          <section v-if="hasSection('paint-color')" class="panel paint-panel">
            <h3 class="panel-title-with-info">
              Paint Color
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <div class="swatch-grid paint-grid">
              <button
                v-for="item in paintColors"
                :key="item.id"
                type="button"
                class="swatch paint-card"
                :class="{ selected: state.paintColorId === item.id }"
                @click="state.paintColorId = item.id"
              >
                <span
                  class="paint-chip"
                  :style="{
                    backgroundImage: item.imageUrl ? `url('${item.imageUrl}')` : `rgba(0,0,0,0)`
                  }"
                />
                <span class="paint-label">{{ item.label }}</span>
                <span v-if="item.price > 0" class="paint-price">+${{ item.price.toFixed(0) }}</span>
                <span v-if="state.paintColorId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <div class="footer-actions" v-if="state.currentStep > 1">
            <button type="button" class="ghost-btn" :disabled="isFirstStep" @click="prevStep">Back</button>
            <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
            <button v-if="!isLastStep" type="button" class="tf-primary-btn" @click="nextStep">Continue</button>
            <button v-else type="button" class="tf-primary-btn" @click="onSubmit">Add to Cart</button>
          </div>
        </div>

        <aside class="preview-card">
          <header>
            <div class="apple-cion">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#FF6467"/>
              </svg>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#FDC700"/>
              </svg>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#05DF72"/>
              </svg>
            </div>
            <span>Your Custom Sign</span>
          </header>
          <div class="preview-canvas" :style="preview.surfaceStyle">
            <div class="preview-sign" :class="selectedShape.id" :style="[preview.signStyle, getPreviewShapeStyle(selectedShape)]">
              <div
                v-if="templateImageUrl"
                class="preview-template-overlay"
                :style="{
                  backgroundColor: selectedPaintColor.hex,
                  backgroundImage: selectedPaintColor.imageUrl ? `url(${selectedPaintColor.imageUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  WebkitMaskImage: `url(${templateImageUrl})`,
                  maskImage: `url(${templateImageUrl})`
                }"
              />
              <!-- <template v-else>
                <span class="preview-number" :style="preview.textStyle">{{ state.houseNumber || '183' }}</span>
                <span class="preview-street" :style="preview.textStyle">{{ state.bottomText || 'EAST STREET' }}</span>
              </template> -->
            </div>
          </div>
          <ul class="spec-list">
            <li><span>Type</span><strong>{{ selectedSignStyle.label }}</strong></li>
            <li><span>Shape</span><strong>{{ selectedShape.label }}</strong></li>
            <li><span>Slate</span><strong>{{ selectedSlateColor.label }}</strong></li>
            <li><span>Template</span><strong>{{ selectedTemplate?.label }}</strong></li>
            <li><span>Paint</span><strong>{{ selectedPaintColor.label }}</strong></li>
            <li><span>Total</span><strong>${{ totalPrice.toFixed(2) }}</strong></li>
          </ul>
        </aside>
      </div>

      <!-- ═══ Step 4: Review & Add to Cart ═══ -->
      <div v-if="state.currentStep === 4" class="split-layout">
        <div class="panel-stack">
          <section class="panel review-panel">
            <label class="field-label">House Number</label>
            <input v-model="state.houseNumber" type="text" class="field-input" />

            <label class="field-label">Bottom Text</label>
            <input v-model="state.bottomText" type="text" class="field-input" placeholder="Street name or custom text" />

            <label class="field-label">Sign Style</label>
            <select v-model="state.signStyleId" class="field-input">
              <option v-for="item in signStyles" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

            <label class="field-label">Paint Color</label>
            <select v-model="state.paintColorId" class="field-input">
              <option v-for="item in paintColors" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

            <label class="field-label">Add-ons</label>
            <select v-model="state.addOnId" class="field-input">
              <option v-for="item in addOns" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

            <label class="field-label">Mounting Hardware</label>
            <select v-model="state.hardwareId" class="field-input">
              <option v-for="item in mountingHardware" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

          </section>
          
          <div class="footer-actions" v-if="state.currentStep > 1">
            <button type="button" class="ghost-btn" :disabled="isFirstStep" @click="prevStep">Back</button>
            <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
            <button v-if="!isLastStep" type="button" class="tf-primary-btn" @click="nextStep">Continue</button>
            <button v-else type="button" class="tf-primary-btn" @click="onSubmit">Add to Cart</button>
          </div>
        </div>
        <aside class="preview-card summary-card">
          <header class="order-summary-header">Order Summary</header>
          <div class="preview-canvas" :style="preview.surfaceStyle">
            <div class="preview-sign" :class="selectedShape.id" :style="[preview.signStyle, getPreviewShapeStyle(selectedShape)]">
              <div
                v-if="templateImageUrl"
                class="preview-template-overlay"
                :style="{
                  backgroundColor: selectedPaintColor.hex,
                  backgroundImage: selectedPaintColor.imageUrl ? `url(${selectedPaintColor.imageUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  WebkitMaskImage: `url(${templateImageUrl})`,
                  maskImage: `url(${templateImageUrl})`
                }"
              />
              <template v-else>
                <span class="preview-number" :style="preview.textStyle">{{ state.houseNumber || '183' }}</span>
                <span class="preview-street" :style="preview.textStyle">{{ state.bottomText || 'EAST STREET' }}</span>
              </template>
            </div>
          </div> 
          <ul class="summary-list">
            <li class="summary-item"><span>Shape &amp; Size: <strong>{{ selectedShape.label }}</strong></span><strong>${{ selectedShape.basePrice.toFixed(2) }}</strong></li>
            <li class="summary-item"><span>Slate Color: <strong>{{ selectedSlateColor.label }}</strong></span><strong>${{ selectedSlateColor.price.toFixed(2) }}</strong></li>
            <li class="summary-item"><span>Template: <strong>{{ selectedTemplate?.label }}</strong></span><strong>${{ (selectedTemplate?.price || 0).toFixed(2) }}</strong></li>
            <li class="summary-item"><span>Paint Color: <strong>{{ selectedPaintColor.label }}</strong></span><strong>${{ selectedPaintColor.price.toFixed(2) }}</strong></li>
            <li class="divider"></li>
            <li class="summary-item-main"><span><strong>{{ formatOptionLabel(selectedAddOn.label) }}</strong></span><strong>+${{ payload.pricing.addOn.toFixed(2) }}</strong></li>
            <li class="summary-item-main"><span><strong>{{ formatOptionLabel(selectedHardware.label) }}</strong></span><strong>+${{ payload.pricing.hardware.toFixed(2) }}</strong></li>
          </ul> 
          <p class="final-total"><span>Total:</span><strong>${{ totalPrice.toFixed(2) }}</strong></p>
          <p class="summary-note">(before shipping &amp; taxes)</p>
        </aside>
      </div>

      <div class="footer-actions" v-if="state.currentStep == 1">
        <button type="button" class="ghost-btn" :disabled="isFirstStep" @click="prevStep">Back</button>
        <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
        <button v-if="!isLastStep" type="button" class="tf-primary-btn" @click="nextStep">Continue</button>
        <button v-else type="button" class="tf-primary-btn" @click="onSubmit">Add to Cart</button>
      </div>

      <section class="payload-box">
        <h4>Configuration Object Output</h4>
        <pre>{{ formattedPayload }}</pre>
      </section>
    </div>
  </section>
</template>

<style scoped>
.selector-root {
  --bg: #eeefd5;
  --panel: #f4f4f6;
  --ink: #2f3040;
  --muted: #6b6b7a;
  --line: #d9d8e0;
  --accent: #6f62a6;
  --accent-soft: #dfdcf2;
  --shadow: 0 10px 26px rgba(47, 48, 64, 0.08);
  background: radial-gradient(circle at 0 0, rgba(111, 98, 166, 0.08), transparent 40%), var(--bg);
  color: var(--ink);
  padding: 32px 16px;
}

/* ── Stepper ─────────────────────────────────────── */
.tf-stepper {
  list-style: none;
  margin: 0;
  padding: 20px 0 0;
  display: flex;
  align-items: flex-start;
}

.tf-step-item {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* connector line – draws from center of this item to center of next */
.tf-step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  width: 100%;
  height: 1.5px;
  background: var(--line);
  z-index: 0;
}

.tf-step-item.complete:not(:last-child)::after {
  background: var(--accent);
}

/* button reset */
.tf-step-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}

/* dot – fixed 20×20 container keeps connector line always centred */
.tf-dot {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

/* inactive: small hollow circle */
.tf-dot::before {
  content: '';
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px solid #c0bfcc;
  background: var(--bg);
  transition: width 0.2s, height 0.2s, background 0.2s, border-color 0.2s;
}

/* active: large filled purple */
.tf-step-item.active .tf-dot::before {
  width: 18px;
  height: 18px;
  background: var(--accent);
  border-color: var(--accent);
}

/* active: inner white dot */
.tf-step-item.active .tf-dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: #fff;
  border-radius: 50%;
  z-index: 2;
}

/* complete: large filled purple */
.tf-step-item.complete .tf-dot::before {
  width: 18px;
  height: 18px;
  background: var(--accent);
  border-color: var(--accent);
}

/* complete: white checkmark */
.tf-step-item.complete .tf-dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 9px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: translate(-50%, -62%) rotate(45deg);
  z-index: 2;
}

/* labels */
.tf-label {
  font-size: 13px;
  line-height: 1.3;
  color: var(--muted);
  white-space: nowrap;
  text-align: center;
  transition: color 0.2s;
  pointer-events: none;
}

.tf-step-item.active .tf-label {
  color: var(--ink);
  font-weight: 700;
}

.hero {
  text-align: center;
  margin: 34px 0 28px;
}

.hero h2 {
  color: var(--Text-Title, #302F37); 
  font-size: 40px; 
  font-weight: 700;
  line-height: 120%; 
  margin: 0;
}

.hero p {
  color: var(--Text-Paragraph, #4D4B58);
  text-align: center;
 
  font-size: 19px; 
  font-weight: 400;
  line-height: 140%; /* 26.6px */
  margin: 8px 0 0;
}

.step-grid {
  display: grid;
  gap: 20px;
}

.card-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.choice-card {
  position: relative;
  min-height: 110px;
  border: 1.5px solid #d8d6df;
  background: #f4f4f6;
  border-radius: 12px;
  padding: 20px 24px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.2s;
}

.choice-card.selected {
  border-radius: 14px;
  border: 2px solid var(--Primary-Default, #675D9A);
  background: #E8E5F6;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -4px rgba(0, 0, 0, 0.10); 
}

.choice-card:not(.selected):hover {
  border-color: #b0adc4;
  background: #f5f4fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.choice-card:not(.selected):hover .choice-icon {
  background: #c5c2d8;
}

.choice-icon {
  
  border-radius: 10px;
  width: 56px;
  height: 56px; 
  display: grid;
  place-items: center;
  background: #d8d6e5;
  color: #3a3946;
  font-size: 28px;
  flex-shrink: 0;
  overflow: hidden;
  transition: background 0.2s;
}

.choice-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.choice-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.choice-icon-svg :deep(svg) {
  width: 32px;
  height: 32px;
}

.choice-card.selected .choice-icon { 
  color: #fff;
  background: var(--Text-Title, #302F37);
}

.choice-card.selected .choice-icon-img {
  filter: brightness(0) invert(1);
}

.choice-card.selected .choice-icon-svg :deep(svg) {
  fill: #fff;
  color: #fff;
}

.choice-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.choice-copy strong {
    color: var(--Text-Title, #302F37) !important; 
    font-size: 28px;
    font-style: normal;
    font-weight: 600;
    line-height: 120%; /* 33.6px */
}

.choice-copy small {
  color: var(--Text-Paragraph, #4D4B58);
 
  font-size: 16px;
  font-style: normal; 
  line-height: 160%; /* 25.6px */
}

.choice-selected-indicator {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.choice-selected-indicator::before {
  content: '';
  width: 6px;
  height: 10px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: translateY(-1px) rotate(45deg);
}

.split-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: start;
}

.panel-stack {
  display: grid;
  gap: 14px;
}

.panel,
.preview-card {
  background: var(--panel);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow);
  border: 1px solid #e0dee8;
}
 
.divider {
	height: 1px;
	width: 100%;
	background: var(--Border-Faint, #EEEEE7);
	margin: 8px 0;
}

.preview-card {
  position: sticky;
  top: 20px;
}

.panel h3,
.preview-card header span {
  color: var(--Text-Title, #302F37);
 
  font-size: 19px; 
  font-weight: 600;
  line-height: 140%; /* 26.6px */
}
.preview-card header{
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.preview-card header .apple-cion {
  display: flex;
  align-items: center;
  gap: 8px; 
}


.pill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.design-template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title-with-info {
  color: var(--Text-Title, #302F37);

  /* Body/Small/Semibold */ 
  font-size: 16px; 
  font-weight: 600;
  line-height: 160%; /* 25.6px */
}

.installation-panel {
  padding: 22px;
}

.installation-title {
 color: var(--Text-Title, #302F37);
 
  font-size: 16px; 
  font-weight: 600;
  line-height: 160%; /* 25.6px */
}

.info-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #9f9ca7;
  color: #7c7987;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.surface-scroller {
  max-height: 296px;
  overflow-y: auto;
  padding-right: 8px;
}

.surface-scroller::-webkit-scrollbar {
  width: 8px;
}

.surface-scroller::-webkit-scrollbar-thumb {
  background: #c8c7ce;
  border-radius: 999px;
}

.surface-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.size-panel,
.slate-panel {
  padding: 20px;
}

.shape-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.tile {
  border-radius: 8px;
  border: 1px solid var(--Border-Default, #D4D4C4);
  padding: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.surface-tile {
  position: relative;
  padding: 8px;
  min-height: 0;
  border: 1px solid var(--Border-Default, #D4D4C4);
  border-radius: 8px;
  background: #fdfcf8;
}

.shape-card,
.slate-card {
  position: relative;
  border: 1px solid #cfcdc0;
  border-radius: 8px;
  background: #fbfaf5;
}

.shape-card {
  padding: 8px;
  align-items: center;
  gap: 7px;
  justify-content: space-between;
}

.shape-preview {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: linear-gradient(135deg, #5f666f 0%, #2b3239 100%);
  color: #f4f4f4;
  display: grid;
  place-items: center;
  margin-inline: auto;
}

.shape-preview.rectangle {
  border-radius: 6px;
}

.shape-preview.oval {
  border-radius: 50%;
}

.shape-preview.arch {
  border-radius: 50%;
}

.shape-preview.round {
  border-radius: 50%;
}

.shape-dim {
  font-size: 14px;
  line-height: 1;
}

.shape-price {
  font-size: 15px;
  line-height: 1.2;
  color: #3e3d48;
  font-weight: 600;
}

.surface-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.surface-check {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
}

.surface-check::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 52%;
  width: 4px;
  height: 8px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: translate(-50%, -62%) rotate(45deg);
}

.option-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
}

.option-check::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 9px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: translate(-50%, -64%) rotate(45deg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.tile.selected,
.swatch.selected {
  border-color:var(--Primary-Default, #675D9A);
  box-shadow: inset 0 0 0 1px var(--Primary-Default, #675D9A); 
  background: #E8E5F6;
}

.shape-card.selected,
.slate-card.selected {
  border-color: #6f62a6;
  box-shadow: inset 0 0 0 1px #6f62a6;
  background: #e8e5f6;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.slate-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.swatch {
  border: 1px solid #d8d6df;
  border-radius: 10px;
  background: #fff;
  padding: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.slate-card {
  padding: 8px;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.swatch-chip {
  width: 100%;
  height: 30px;
  border-radius: 6px;
  border: 1px solid #ccc;
}

.slate-chip {
  border-radius: 6px;
  /* background-size: cover; */
  background-position: center;
  background-repeat: no-repeat;
}

.slate-chip.rectangle {
  border-radius: 6px;
}

.slate-chip.oval,
.slate-chip.oval {
  border-radius: 50%;
}

.slate-chip.arch {
  border-radius: 50%;
}

.slate-chip.round {
  border-radius: 50%;
  margin-inline: auto;
}

.slate-label {
  font-size: 15px;
  line-height: 1.2;
  color: #383741;
  font-weight: 600;
}

.slate-price {
  color: var(--Text-Paragraph, #4D4B58);
 
  font-size: 13px; 
  font-weight: 400;
  line-height: 150%; /* 19.5px */
}

/* ── Paint Color grid ──────────────────────────────── */
.paint-panel {
  padding: 20px;
}

.paint-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.paint-card {
  position: relative;
  border: 1px solid #cfcdc0;
  border-radius: 8px;
  background: #fbfaf5;
  padding: 8px;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.paint-card.selected {
  border-color: #6f62a6;
  box-shadow: inset 0 0 0 1px #6f62a6;
  background: #e8e5f6;
}

.paint-chip {
  display: block;
  width: 100%;
  height: 80px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.paint-label {
  font-size: 13px;
  line-height: 1.2;
  color: #383741;
  font-weight: 600;
}

.paint-price {
  font-size: 11px;
  line-height: 1;
  color: #fff;
  background: #e03e3e;
  border-radius: 20px;
  padding: 2px 7px;
  position: absolute;
  top: 6px;
  left: 6px;
}

/* ── Tier tabs & template images ────────────────────── */
.tier-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 14px;
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  overflow: hidden;
  width: fit-content;
  padding: 4px;
}

.tier-tab {
  background: transparent;
  border: none;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.tier-tab.active {
  background: var(--accent);
  color: #fff;
}

.tier-tab:not(.active):hover {
  background: var(--accent-soft);
}

.template-grid {
  gap: 10px;
}

.template-tile {
  position: relative;
}

.template-thumb {
  width: 100%;
  max-height: 80px;
  border-radius: 6px;
  object-fit: contain; 
}

/* Template overlay on sign preview – uses CSS mask to apply paint color */
.preview-template-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.preview-canvas {
  border-radius: 10px;
  min-height: 280px;
  display: grid;
  place-items: center;
  border: 1px solid #d4d3de;
  margin-bottom: 10px;
}

.preview-sign {
  position: relative;
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 2px solid rgba(0, 0, 0, 0.18);
  color: #f8f2d8;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.32);
}

.preview-sign.oval {
  border-radius: 90%;
}

.preview-sign.rectangle {
  border-radius: 10px;
}

.preview-sign.arch {
  border-radius: 50%;
}

.preview-sign.round {
  border-radius: 50%;
}

.preview-number {
  font-size: 56px;
  line-height: 1;
  font-weight: 700;
}

.preview-street {
  letter-spacing: 2px;
  font-size: 14px;
}

.spec-list,
.price-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.spec-list li,
.price-list li,
.final-total {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
}

.spec-list span,
.price-list span {
  color: var(--muted);
}

.review-panel {
  display: grid;
  gap: 6px;
  align-content: start;
}

.field-label {
  color: var(--Text-Title, #302F37);
 
  font-size: 16px; 
  font-weight: 600;
  line-height: 160%; /* 25.6px */
  margin-top: 8px;
}

.field-input {
  border: 1px solid #d5d3cc;
  border-radius: 4px;
  background: #fff;
  padding: 10px 12px;
  min-height: 42px;
  font-size: 15px;
  color: #4c4b57;
}

.summary-card {
  padding: 16px 16px 18px;
}

.summary-card header {
  color: var(--Text-Title, #302F37);
  margin-bottom: 20px;
  font-size: 19px; 
  font-weight: 600;
  line-height: 140%; /* 26.6px */
}

.summary-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.summary-item,
.summary-item-main,
.final-total {
  display: flex;
  justify-content: space-between;
  gap: 12px; 
  color: var(--Text-Faint, #605E6E);
 
  font-size: 16px; 
  font-weight: 400;
  line-height: 160%; /* 25.6px */
}

.summary-item span {
  color: #5f5d6d;
  
}
.summary-item-main span strong,
.summary-item span strong {
  color: var(--Text-Title, #302F37);
 
  font-size: 16px; 
  font-weight: 600;
  line-height: 160%; /* 25.6px */
}

.summary-item strong,
.summary-item-main strong {
  color: #2f3040;
  font-weight: 500;
}

.summary-item-main { 
  color: #2f3040;
}

.final-total {
  border-top: 1px solid #dad8e1;
  margin-top: 16px;
  padding-top: 14px; 
  color: #2f3040;
  color: var(--Text-Title, #302F37); 
  font-size: 19px; 
  font-weight: 400;
  line-height: 140%; /* 26.6px */
}

.summary-note {
  margin: 2px 0 0;
  text-align: right;
  color: #8a8896;
  font-size: 12px;
}

.footer-actions {
  margin-top: 22px;
  display: grid;
  grid-template-columns: 96px 1fr 132px;
  align-items: center;
  gap: 16px;
}

.tf-primary-btn,
.ghost-btn {
  min-height: 44px;
  border-radius: 9px;
  padding: 10px 18px;
  border: 1px solid transparent;
  cursor: pointer;
  line-height: 1;
  font-weight: 500;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.tf-primary-btn { 
  
  font-size: 28px;
  padding: 10px 24px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  border: 1px solid var(--Primary-Default, #675D9A);
  background: var(--Primary-Default, #675D9A);
  color: var(--Fill-White, #FFF);
  text-align: center;
 
  font-size: 16px; 
  font-weight: 600;
  line-height: 160%; /* 25.6px */
}

.ghost-btn {
  background: #f0f0e4;
  border-color: #dddbce;
  color: #7f7c71;
  width: 84px;
}

.ghost-btn:disabled {
 color: var(--Border-Default, #D4D4C4);
text-align: center;
 
font-size: 16px; 
font-weight: 600;
line-height: 160%; /* 25.6px */
padding: 10px 24px;
justify-content: center;
align-items: center;
gap: 8px;
border-radius: 8px;
border: 1px solid var(--Border-Faint, #EEEEE7);
}

.footer-step {
  color: var(--Text-Faint, #605E6E);
  text-align: center;
  
  font-size: 13px; 
  font-weight: 400;
  line-height: 150%; /* 19.5px */
}

.payload-box {
  margin-top: 16px;
  background: #2c2f43;
  color: #f8f9ff;
  border-radius: 12px;
  padding: 14px;
}

.payload-box h4 {
  margin: 0 0 10px;
}

.payload-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .card-grid-2,
  .split-layout {
    grid-template-columns: 1fr;
  }

  .surface-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .shape-grid,
  .slate-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

 
  .label {
    font-size: 11px;
  }

  .choice-copy strong {
    font-size: clamp(20px, 6vw, 28px);
  }

  .choice-copy small {
    font-size: clamp(14px, 4vw, 18px);
  }

  .choice-card {
    min-height: 100px;
    padding: 18px;
  }

  .choice-icon {
    width: 50px;
    height: 50px;
    font-size: 24px;
  }

  .tf-label {
    white-space: normal;
    font-size: 11px;
    max-width: 72px;
  }
}

@media (max-width: 560px) {
  .swatch-grid,
  .pill-grid {
    grid-template-columns: 1fr;
  }

  .surface-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .shape-grid,
  .slate-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .installation-panel {
    padding: 14px;
  }

  .surface-scroller {
    max-height: 264px;
  }

  .footer-actions {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'step step'
      'back next';
    gap: 12px;
  }

  .footer-step {
    grid-area: step;
    font-size: 18px;
  }

  .ghost-btn {
    grid-area: back;
    width: 100%;
  }

  .primary-btn {
    grid-area: next;
    width: 100%;
  }

  .tf-label {
    font-size: 10px;
    max-width: 56px;
  }
}
</style>
