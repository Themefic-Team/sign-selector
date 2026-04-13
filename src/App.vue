<script setup>
import { computed } from 'vue'
import { useSignSelectorState } from './useSignSelectorState'

const {
  stepDefinitions,
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

const onSubmit = async () => {
  await submitConfiguration()
}
</script>

<template>
  <section class="selector-root">
    <div class="selector-shell">
      <ol class="stepper" aria-label="Sign setup steps">
        <li
          v-for="step in stepDefinitions"
          :key="step.id"
          class="step-item"
          :class="{
            active: state.currentStep === step.id,
            complete: state.currentStep > step.id
          }"
        >
          <button type="button" class="step-btn" @click="setStep(step.id)">
            <span class="dot" />
            <span class="label">{{ step.title }}</span>
          </button>
        </li>
      </ol>

      <header class="hero">
        <h2>{{ stepDefinitions[state.currentStep - 1].heading }}</h2>
        <p>{{ stepDefinitions[state.currentStep - 1].subheading }}</p>
      </header>

      <div v-if="state.currentStep === 1" class="step-grid card-grid-2">
        <button
          v-for="item in signStyles"
          :key="item.id"
          type="button"
          class="choice-card"
          :class="{ selected: state.signStyleId === item.id }"
          @click="state.signStyleId = item.id"
        >
          <span class="choice-icon">{{ item.icon }}</span>
          <span class="choice-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
        </button>
      </div>

      <div v-if="state.currentStep === 2" class="split-layout">
        <div class="panel-stack">
          <section class="panel">
            <h3>Installation Surface</h3>
            <div class="pill-grid">
              <button
                v-for="item in installationSurfaces"
                :key="item.id"
                type="button"
                class="tile"
                :class="{ selected: state.surfaceId === item.id }"
                @click="state.surfaceId = item.id"
              >
                {{ item.label }}
              </button>
            </div>
          </section>

          <section class="panel">
            <h3>Size & Shape</h3>
            <div class="pill-grid">
              <button
                v-for="item in shapes"
                :key="item.id"
                type="button"
                class="tile"
                :class="{ selected: state.shapeId === item.id }"
                @click="state.shapeId = item.id"
              >
                <span>{{ item.label }}</span>
                <small>${{ item.basePrice.toFixed(2) }}</small>
              </button>
            </div>
          </section>

          <section class="panel">
            <h3>Slate Color</h3>
            <div class="swatch-grid">
              <button
                v-for="item in slateColors"
                :key="item.id"
                type="button"
                class="swatch"
                :class="{ selected: state.slateColorId === item.id }"
                @click="state.slateColorId = item.id"
              >
                <span class="swatch-chip" :style="{ background: item.hex }" />
                <span>{{ item.label }}</span>
                <small>${{ item.price.toFixed(2) }}</small>
              </button>
            </div>
          </section>
        </div>

        <aside class="preview-card">
          <header>Your Custom Sign</header>
          <div class="preview-canvas" :style="preview.surfaceStyle">
            <div class="preview-sign" :class="selectedShape.id" :style="preview.signStyle">
              <span class="preview-number">{{ selectedTemplate.previewText }}</span>
              <span class="preview-street">EAST STREET</span>
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

      <div v-if="state.currentStep === 3" class="split-layout">
        <div class="panel-stack">
          <section class="panel">
            <h3>Design Template</h3>
            <div class="pill-grid">
              <button
                v-for="item in designTemplates"
                :key="item.id"
                type="button"
                class="tile"
                :class="{ selected: state.templateId === item.id }"
                @click="state.templateId = item.id"
              >
                <span>{{ item.label }}</span>
                <small>{{ item.tier }}</small>
              </button>
            </div>
          </section>

          <section class="panel">
            <h3>Paint Color</h3>
            <div class="swatch-grid">
              <button
                v-for="item in paintColors"
                :key="item.id"
                type="button"
                class="swatch"
                :class="{ selected: state.paintColorId === item.id }"
                @click="state.paintColorId = item.id"
              >
                <span class="swatch-chip" :style="{ background: item.hex }" />
                <span>{{ item.label }}</span>
                <small>${{ item.price.toFixed(2) }}</small>
              </button>
            </div>
          </section>
        </div>

        <aside class="preview-card">
          <header>Your Custom Sign</header>
          <div class="preview-canvas" :style="preview.surfaceStyle">
            <div class="preview-sign" :class="selectedShape.id" :style="preview.signStyle">
              <span class="preview-number">{{ selectedTemplate.previewText }}</span>
              <span class="preview-street">{{ selectedTemplate.accentText }}</span>
            </div>
          </div>
          <ul class="spec-list">
            <li><span>Template</span><strong>{{ selectedTemplate.label }}</strong></li>
            <li><span>Paint</span><strong>{{ selectedPaintColor.label }}</strong></li>
            <li><span>Slate</span><strong>{{ selectedSlateColor.label }}</strong></li>
            <li><span>Total</span><strong>${{ totalPrice.toFixed(2) }}</strong></li>
          </ul>
        </aside>
      </div>

      <div v-if="state.currentStep === 4" class="split-layout">
        <section class="panel review-panel">
          <h3>Review Your Sign</h3>

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

        <aside class="preview-card">
          <header>Order Summary</header>
          <ul class="price-list">
            <li><span>Shape & Size: {{ selectedShape.label }}</span><strong>${{ selectedShape.basePrice.toFixed(2) }}</strong></li>
            <li><span>Slate Color: {{ selectedSlateColor.label }}</span><strong>${{ selectedSlateColor.price.toFixed(2) }}</strong></li>
            <li><span>Template: {{ selectedTemplate.label }}</span><strong>${{ selectedTemplate.price.toFixed(2) }}</strong></li>
            <li><span>Paint Color: {{ selectedPaintColor.label }}</span><strong>${{ selectedPaintColor.price.toFixed(2) }}</strong></li>
            <li><span>Add-on</span><strong>${{ payload.pricing.addOn.toFixed(2) }}</strong></li>
            <li><span>Hardware</span><strong>${{ payload.pricing.hardware.toFixed(2) }}</strong></li>
          </ul>
          <p class="final-total"><span>Total</span><strong>${{ totalPrice.toFixed(2) }}</strong></p>
        </aside>
      </div>

      <div class="footer-actions">
        <button type="button" class="ghost-btn" :disabled="isFirstStep" @click="prevStep">Back</button>
        <small>Step {{ state.currentStep }} of 4</small>
        <button v-if="!isLastStep" type="button" class="primary-btn" @click="nextStep">Continue</button>
        <button v-else type="button" class="primary-btn" @click="onSubmit">Add to Cart</button>
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

.selector-shell {
  max-width: 1120px;
  margin: 0 auto;
  font-family: "Segoe UI", sans-serif;
}

.stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.step-item {
  position: relative;
}

.step-item::before {
  content: "";
  position: absolute;
  top: 13px;
  left: calc(-50% + 13px);
  width: calc(100% - 26px);
  border-top: 2px solid var(--line);
}

.step-item:first-child::before {
  display: none;
}

.step-item.complete::before,
.step-item.active::before {
  border-top-color: var(--accent);
}

.step-btn {
  background: transparent;
  border: 0;
  padding: 0;
  width: 100%;
  cursor: pointer;
  display: grid;
  justify-items: center;
  gap: 6px;
}

.dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 3px solid #b9b7c7;
  background: #fff;
  z-index: 1;
}

.step-item.active .dot,
.step-item.complete .dot {
  border-color: var(--accent);
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: #4d4c5f;
}

.hero {
  text-align: center;
  margin: 34px 0 28px;
}

.hero h2 {
  margin: 0;
  font-size: clamp(30px, 4vw, 48px);
}

.hero p {
  margin: 8px 0 0;
  color: var(--muted);
}

.step-grid {
  display: grid;
  gap: 18px;
}

.card-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.choice-card {
  border: 2px solid var(--line);
  background: #fff;
  border-radius: 14px;
  padding: 22px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--shadow);
}

.choice-card.selected {
  border-color: var(--accent);
  background: #ece9f7;
}

.choice-icon {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #d8d5e8;
  font-size: 26px;
}

.choice-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.choice-copy strong {
  font-size: 22px;
}

.choice-copy small {
  color: var(--muted);
  font-size: 20px;
}

.split-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
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

.panel h3,
.preview-card header {
  margin: 0 0 12px;
  font-size: 18px;
}

.pill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tile {
  border: 1px solid #d8d6df;
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tile.selected,
.swatch.selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
  background: #edeaf8;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
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

.swatch-chip {
  width: 100%;
  height: 30px;
  border-radius: 6px;
  border: 1px solid #ccc;
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
  width: 220px;
  min-height: 110px;
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
  border-radius: 999px;
}

.preview-sign.rectangle {
  border-radius: 10px;
}

.preview-sign.arch {
  border-radius: 22px 22px 10px 10px;
}

.preview-sign.round {
  width: 170px;
  height: 170px;
  border-radius: 999px;
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
  gap: 8px;
  align-content: start;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
}

.field-input {
  border: 1px solid #d1cfda;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
}

.footer-actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
}

.primary-btn,
.ghost-btn {
  border-radius: 8px;
  padding: 10px 18px;
  border: 1px solid transparent;
  cursor: pointer;
}

.primary-btn {
  background: var(--accent);
  color: #fff;
}

.ghost-btn {
  background: transparent;
  border-color: #d6d5dc;
  color: #47465a;
}

.ghost-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

  .stepper {
    gap: 4px;
  }

  .label {
    font-size: 11px;
  }

  .choice-copy strong {
    font-size: 20px;
  }
}

@media (max-width: 560px) {
  .swatch-grid,
  .pill-grid {
    grid-template-columns: 1fr;
  }

  .footer-actions {
    grid-template-columns: 1fr;
    text-align: center;
  }
}
</style>
