<script setup>
import { computed, ref, watch } from 'vue'
import { useSignSelectorState } from './useSignSelectorState'
import { vSelect2 } from './directives/vSelect2'

const {
  stepDefinitions,
  hasSection,
  totalSteps,
  state,
  signStyles,
  installationSurfaces,
  shapes,
  slateColors,
  availableDesignTemplates,
  paintColors,
  addOns,
  mountingHardware,
  selectedSignStyle,
  selectedShape,
  selectedSlateColor,
  selectedTemplate,
  selectedPaintColor,
  selectedAddOns,
  selectedHardware,
  totalPrice,
  payload,
  preview,
  getSlateColorImageUrl,
  isFirstStep,
  isLastStep,
  setStep,
  nextStep,
  prevStep,
  submitConfiguration
} = useSignSelectorState()

const formatOptionLabel = (label) => label ? label.replace(/\s*\((\+)?\$\d+\)\s*$/i, '') : ''

const activeTier = ref('Deluxe')
const previewCaptureRef = ref(null)
const reviewErrors = ref({})
const stepError = ref('')
const isNavigating = ref(false)

watch(
  [() => state.signStyleId, () => state.shapeId, () => state.slateColorId,
   () => state.templateId, () => state.paintColorId, () => state.currentStep],
  () => { stepError.value = '' }
)

const validateCurrentStep = () => validateStep(state.currentStep)

const selectChoiceAndAutoAdvance = async (fieldKey, value) => {
  if (isNavigating.value || isLastStep.value) return
  if (state[fieldKey] === value) return

  state[fieldKey] = value
  stepError.value = ''

  const error = validateCurrentStep()
  if (error) return

  isNavigating.value = true
  await new Promise(r => setTimeout(r, 220))
  isNavigating.value = false
  nextStep()
}

const handleNext = async () => {
  const error = validateCurrentStep()
  if (error) {
    stepError.value = error
    return
  }
  stepError.value = ''
  isNavigating.value = true
  await new Promise(r => setTimeout(r, 400))
  isNavigating.value = false
  nextStep()
}

const validateStep = (step) => {
  if (step === 1 && !state.signStyleId) {
    return 'Please select a sign style to continue.'
  }
  if (isNoShapeFlow.value) {
    if (step === 2) {
      if (hasSection('design-template') && !state.templateId) return 'Please select a design template to continue.'
    }
    if (step === 3) {
      if (hasSection('slate-color') && !state.slateColorId) return 'Please select a slate color to continue.'
      if (hasSection('paint-color') && !state.paintColorId) return 'Please select a paint color to continue.'
    }
  } else {
    if (step === 2) {
      if (hasSection('size-shape') && !state.shapeId) return 'Please select a size & shape to continue.'
      if (hasSection('slate-color') && !state.slateColorId) return 'Please select a slate color to continue.'
    }
    if (step === 3) {
      if (hasSection('design-template') && !state.templateId) return 'Please select a design template to continue.'
      if (hasSection('paint-color') && !state.paintColorId) return 'Please select a paint color to continue.'
    }
  }
  return ''
}

const handleSetStep = (targetStep) => {
  // Always allow going back
  if (targetStep <= state.currentStep) {
    stepError.value = ''
    setStep(targetStep)
    return
  }
  // Validate every step between current and target
  for (let s = state.currentStep; s < targetStep; s++) {
    const error = validateStep(s)
    if (error) {
      stepError.value = error
      return
    }
  }
  stepError.value = ''
  setStep(targetStep)
}

const FIELD_META = {
  firstLine: {
    label: 'First Line of Text',
    placeholder: 'Enter the first line of text',
    fallback: 'WELCOME'
  },
  secondLine: {
    label: 'Second Line of Text',
    placeholder: 'Enter the second line of text',
    fallback: 'HOME'
  },
  topText: {
    label: 'Top Text',
    placeholder: 'Enter the top text',
    fallback: 'THE WILLOWS'
  },
  houseNumber: {
    label: 'House Number',
    placeholder: 'Enter the number',
    fallback: '183'
  },
  bottomText: {
    label: 'Bottom Text',
    placeholder: 'Enter the bottom text',
    fallback: 'EAST STREET'
  }
}

const availableTemplateTiers = computed(() => [...new Set(availableDesignTemplates.value.map(t => t.tier).filter(Boolean))])
const tieredTemplates = computed(() => availableDesignTemplates.value.filter(t => t.tier === activeTier.value))
const hasTiers = computed(() => availableTemplateTiers.value.length > 1)
// True when size-shape is not in the active flow (e.g. "Something Custom")
// In this case Design Template moves to Step 2 and Slate/Paint move to Step 3
const isNoShapeFlow = computed(() => !hasSection('size-shape'))
const selectedStyleSubtitle = computed(() => selectedSignStyle.value?.label ? `Style: ${selectedSignStyle.value.label}` : '')

const hasValueForSection = (sectionId) => {
  if (sectionId === 'installation-surface') return Boolean(state.surfaceId)
  if (sectionId === 'size-shape') return Boolean(state.shapeId)
  if (sectionId === 'slate-color') return Boolean(state.slateColorId)
  if (sectionId === 'design-template') return Boolean(state.templateId)
  if (sectionId === 'paint-color') return Boolean(state.paintColorId)
  return true
}

const canEditSectionInFlow = (currentSectionId, orderedFlow) => {
  const currentIndex = orderedFlow.indexOf(currentSectionId)
  if (currentIndex < 0) return true

  for (let i = 0; i < currentIndex; i++) {
    const prevSectionId = orderedFlow[i]
    if (!hasSection(prevSectionId)) continue
    if (!hasValueForSection(prevSectionId)) return false
  }

  return true
}

const canSelectTemplateStep2 = computed(() => {
  if (!isNoShapeFlow.value) return true
  return canEditSectionInFlow('design-template', ['installation-surface', 'design-template'])
})

const canSelectShape = computed(() => canEditSectionInFlow('size-shape', ['installation-surface', 'size-shape', 'slate-color']))
const canSelectSlateStep2 = computed(() => canEditSectionInFlow('slate-color', ['installation-surface', 'size-shape', 'slate-color']))
const canSelectTemplateStep3 = computed(() => canEditSectionInFlow('design-template', ['design-template', 'paint-color']))
const canSelectSlateStep3 = computed(() => canEditSectionInFlow('slate-color', ['design-template', 'slate-color', 'paint-color']))
const canSelectPaintStep3 = computed(() => canEditSectionInFlow('paint-color', ['design-template', 'paint-color']))
const canSelectPaintStep3NoShape = computed(() => canEditSectionInFlow('paint-color', ['design-template', 'slate-color', 'paint-color']))

watch(availableTemplateTiers, (tiers) => {
  if (!tiers.length) {
    activeTier.value = 'Deluxe'
    return
  }

  if (!tiers.includes(activeTier.value)) {
    activeTier.value = tiers[0]
  }
}, { immediate: true })

const templateImageUrl = computed(() => {
  const tpl = selectedTemplate.value
  if (!tpl) return ''
  return tpl.imageUrl || ''
})

// Track natural dimensions of the template image for no-shape-flow preview
const templateNaturalSize = ref({ width: 1, height: 1 })
watch(templateImageUrl, (url) => {
  if (!url) {
    templateNaturalSize.value = { width: 1, height: 1 }
    return
  }
  const img = new Image()
  img.onload = () => {
    templateNaturalSize.value = { width: img.naturalWidth || 1, height: img.naturalHeight || 1 }
  }
  img.src = url
}, { immediate: true })

const noShapePreviewStyle = computed(() => {
  const tWidth = templateNaturalSize.value.width || 1;
  const tHeight = templateNaturalSize.value.height || 1;
  const isVertical = tHeight > tWidth;
  const label = selectedTemplate.value?.label?.toLowerCase() || '';
  const isOval = label.includes('oval');
  const isArched = label.includes('arch');

  let maxWidth = '280px';
  if (isVertical && isOval) {
    maxWidth = '210px'; // Reduce width to prevent excessive height for vertical ovals
  }

  let borderRadius = '6px';
  if (isOval) {
    borderRadius = '50%';
  } else if (isArched) {
    borderRadius = '50% 50% 0 0';
  }

  return {
    ...preview.value.signStyle,
    aspectRatio: `${tWidth} / ${tHeight}`,
    width: `min(100%, ${maxWidth})`,
    height: 'auto',
    borderRadius
  };
})

const templateWrapperStyle = computed(() => {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: 'inherit',
    mixBlendMode: 'screen',
    isolation: 'isolate',
    overflow: 'hidden'
  }
})

const paintBackgroundStyle = computed(() => {
  const paintTextureUrl = selectedPaintColor.value?.imageUrl || ''
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: 'inherit',
    backgroundColor: 'rgb(236, 230, 205)',
    backgroundImage: paintTextureUrl ? `url("${paintTextureUrl}")` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat', 
    clipPath: 'inset(1%)',
  }
})

const templateDesignStyle = computed(() => {
  if (!templateImageUrl.value) return {}
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: 'inherit',
    backgroundImage: `url("${templateImageUrl.value}")`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    mixBlendMode: 'multiply',
    clipPath: 'inset(1%)',
    filter: 'drop-shadow(rgba(255, 255, 255, 0.4) -0.5px -0.5px 0px) drop-shadow(rgba(0, 0, 0, 0.15) 1px 1px 1px)'
  }
})

const normalizeTemplateFieldKey = (value) => {
  const normalized = String(value || '').trim().toLowerCase()

  if (['first', 'firstline', 'first_line', 'line1', 'line_1'].includes(normalized)) return 'firstLine'
  if (['second', 'secondline', 'second_line', 'line2', 'line_2'].includes(normalized)) return 'secondLine'
  if (['top', 'toptext', 'top_text', 'header', 'title'].includes(normalized)) return 'topText'
  if (['number', 'house', 'housenumber', 'house_number', 'address'].includes(normalized)) return 'houseNumber'
  if (['bottom', 'bottomtext', 'bottom_text', 'street', 'footer', 'subtitle'].includes(normalized)) return 'bottomText'

  return ''
}

const getTemplateFieldsFromMetadata = (template) => {
  if (Array.isArray(template?.fields) && template.fields.length) {
    return template.fields
      .map(normalizeTemplateFieldKey)
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
  }

  const layout = String(template?.textLayout || '').trim().toLowerCase()

  if (layout === 'top-number-bottom' || layout === 'top_house_bottom' || layout === 'full') {
    return ['topText', 'houseNumber', 'bottomText']
  }

  if (layout === 'two-lines') {
    return ['firstLine', 'secondLine']
  }

  if (layout === 'one-line') {
    return ['firstLine']
  }

  if (layout === 'number') {
    return ['houseNumber']
  }

  return ['houseNumber', 'bottomText']
}

const reviewFields = computed(() => {
  return getTemplateFieldsFromMetadata(selectedTemplate.value)
    .map((key) => ({ key, ...FIELD_META[key] }))
    .filter((field) => field.key)
})

const getPreviewLayout = () => {
  const keys = reviewFields.value.map((field) => field.key)

  if (keys.includes('topText')) return 'top-number-bottom'
  if (keys.includes('bottomText')) return 'number-bottom'
  return 'number'
}

const getPreviewFieldValue = (fieldKey) => {
  const value = String(state[fieldKey] || '').trim()

  if (!value) {
    return FIELD_META[fieldKey]?.fallback || ''
  }

  return fieldKey === 'houseNumber' ? value : value.toUpperCase()
}

const getPreviewTextStyle = (fieldKey) => {
  const layout = getPreviewLayout()

  if (layout === 'top-number-bottom') {
    if (fieldKey === 'topText') return { top: '25%', fontSize: '12px', letterSpacing: '0.24em' }
    if (fieldKey === 'houseNumber') return { top: '50%', fontSize: '52px', letterSpacing: '0.03em' }
    return { top: '74%', fontSize: '14px', letterSpacing: '0.18em' }
  }

  if (layout === 'number-bottom') {
    if (fieldKey === 'houseNumber') return { top: '44%', fontSize: '56px', letterSpacing: '0.02em' }
    return { top: '72%', fontSize: '14px', letterSpacing: '0.18em' }
  }

  return { top: '50%', fontSize: '56px', letterSpacing: '0.02em' }
}

const clearFieldError = (fieldKey) => {
  if (!reviewErrors.value[fieldKey]) return

  const nextErrors = { ...reviewErrors.value }
  delete nextErrors[fieldKey]
  reviewErrors.value = nextErrors
}

const validateReviewFields = () => {
  const errors = {}

  reviewFields.value.forEach((field) => {
    if (!String(state[field.key] || '').trim()) {
      errors[field.key] = `${field.label} is required.`
    }
  })

  if (!state.requireProof) {
    errors.requireProof = 'Please select whether you require a proof or not.'
  }

  reviewErrors.value = errors
  state.status = Object.keys(errors).length ? 'error' : 'idle'
  state.message = Object.keys(errors).length ? 'Please complete all required fields before adding to cart.' : ''

  return Object.keys(errors).length === 0
}

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
  width: shape?.id === 'round' ? 'min(100%, 180px)' : shape?.id === 'oval' || shape?.id === 'rectangle' ? 'min(100%, 300px)' : 'min(100%, 350px)',
  minHeight: 'auto' 
})

const onSubmit = async () => {
  if (state.status === 'submitting') return
  state.firstLine = String(state.firstLine || '').trim()
  state.secondLine = String(state.secondLine || '').trim()  
  state.topText = String(state.topText || '').trim()
  state.houseNumber = String(state.houseNumber || '').trim()
  state.bottomText = String(state.bottomText || '').trim()

  if (!validateReviewFields()) {
    return
  }

  await submitConfiguration({
    previewImageName: `sign-preview-${Date.now()}.png`,
    previewImageUrl: selectedTemplate.value?.imageUrl || '',
    checkoutOverrides: {
      firstLine: reviewFields.value.some((field) => field.key === 'firstLine') ? state.firstLine : '',
      secondLine: reviewFields.value.some((field) => field.key === 'secondLine') ? state.secondLine : '',
      topText: reviewFields.value.some((field) => field.key === 'topText') ? state.topText : '',
      houseNumber: reviewFields.value.some((field) => field.key === 'houseNumber') ? state.houseNumber : '',
      bottomText: reviewFields.value.some((field) => field.key === 'bottomText') ? state.bottomText : ''
    }
  })
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
          <button type="button" class="tf-step-btn" @click="handleSetStep(idx + 1)">
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
          @click="selectChoiceAndAutoAdvance('signStyleId', item.id)"
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
            <p v-if="selectedStyleSubtitle" class="panel-style-subtitle">{{ selectedStyleSubtitle }}</p>
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

          <!-- Design Template — shown in Step 2 when size-shape is not in flow -->
          <section v-if="isNoShapeFlow && hasSection('design-template')" class="panel" :class="{ 'panel-disabled': !canSelectTemplateStep2 }">
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
                  @click="activeTier = 'Regular'"
                >Regular</button>
              </div>
            </div>

            <p v-if="!availableDesignTemplates.length" class="template-empty">
              No templates are available for the selected sign style.
            </p>

            <!-- Filtered templates by active tier -->
            <div v-else-if="hasTiers" class="pill-grid template-grid">
              <button
                v-for="item in tieredTemplates"
                :key="item.id"
                type="button"
                class="tile template-tile"
                  :disabled="!canSelectTemplateStep2"
                :class="{ selected: state.templateId === item.id }"
                @click="state.templateId = item.id"
              >
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.label" class="template-thumb" />
                <span v-if="state.templateId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>

            <!-- Fallback: templates without tier grouping -->
            <div v-else class="pill-grid template-grid">
              <button
                v-for="item in availableDesignTemplates"
                :key="item.id"
                type="button"
                class="tile template-tile"
                  :disabled="!canSelectTemplateStep2"
                :class="{ selected: state.templateId === item.id }"
                @click="state.templateId = item.id"
              >
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.label" class="template-thumb" />
              </button>
            </div>
          </section>

          <!-- Size & Shape (flow-dependent) -->
          <section v-if="!isNoShapeFlow && hasSection('size-shape')" class="panel size-panel" :class="{ 'panel-disabled': !canSelectShape }">
            <h3 class="panel-title-with-info">
              Size & Shape
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <p v-if="selectedStyleSubtitle" class="panel-style-subtitle">{{ selectedStyleSubtitle }}</p>
            <div class="shape-grid">
              <button
                v-for="item in shapes"
                :key="item.id"
                type="button"
                class="tile shape-card"
                :disabled="!canSelectShape"
                :class="{ selected: state.shapeId === item.id }"
                @click="state.shapeId = item.id"
              >
                <span class="shape-preview" :class="item.id" :style="getShapeCardStyle(item)">
                  <span class="shape-dim">{{ item.label }}</span>
                </span>
                <small class="shape-price" v-if="item.basePrice != 0">${{ item.basePrice.toFixed(2) }}</small>
                <span v-if="state.shapeId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <!-- Slate Color (flow-dependent, only shown in Step 2 for normal flow) -->
          <section v-if="!isNoShapeFlow && hasSection('slate-color')" class="panel slate-panel" :class="{ 'panel-disabled': !canSelectSlateStep2 }">
            <h3 class="panel-title-with-info">
              Slate Color
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <p v-if="selectedStyleSubtitle" class="panel-style-subtitle">{{ selectedStyleSubtitle }}</p>
            <div class="swatch-grid slate-grid">
              <button
                v-for="item in slateColors"
                :key="item.id"
                type="button"
                class="swatch slate-card"
                :disabled="!canSelectSlateStep2"
                :class="{ selected: state.slateColorId === item.id }"
                @click="state.slateColorId = item.id"
              >
                <span
                  class="swatch-chip slate-chip"
                  :class="selectedShape.id"
                  :style="getSlateChipStyle(
                    selectedShape,
                    getSlateColorImageUrl(item, selectedShape.id)
                  )"
                />
                <span class="slate-label">{{ item.label }}</span>
                <small class="slate-price">${{ item.price.toFixed(2) }}</small>
                <span v-if="state.slateColorId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <div class="footer-actions" v-if="state.currentStep > 1">
            <p v-if="stepError" class="step-error" role="alert">{{ stepError }}</p>
            <button type="button" class="ghost-btn" :disabled="isFirstStep || isNavigating" @click="prevStep">Back</button>
            <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
            <button v-if="!isLastStep" type="button" class="tf-primary-btn" :disabled="isNavigating" @click="handleNext">
              <span v-if="isNavigating" class="btn-spinner" aria-hidden="true"></span>
              <span v-else>Next</span>
            </button>
            <button v-else type="button" class="tf-primary-btn" :disabled="state.status === 'submitting'" @click="onSubmit">
              <span v-if="state.status === 'submitting'" class="btn-spinner" aria-hidden="true"></span>
              <span v-else>Next</span>
            </button>
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
          <div class="preview-canvas" :class="[selectedShape?.id, state.slateColorId]" :style="preview.surfaceStyle">
            <template v-if="isNoShapeFlow">
              <div v-if="templateImageUrl" class="preview-no-shape-sign" :style="noShapePreviewStyle">
                <div class="preview-template-wrapper" :style="templateWrapperStyle">
                  <div class="preview-paint-bg" :style="paintBackgroundStyle" />
                  <div class="preview-template-overlay" :style="templateDesignStyle" />
                </div>
              </div>
              <span v-else class="preview-no-template">Select a template to preview</span>
            </template>
            <template v-else>
              <div v-if="selectedShape?.id" class="preview-sign" :class="[selectedShape?.id, state.slateColorId]" :style="[preview.signStyle, getPreviewShapeStyle(selectedShape)]">
                <div v-if="templateImageUrl" class="preview-template-wrapper" :style="templateWrapperStyle">
                  <div class="preview-paint-bg" :style="paintBackgroundStyle" />
                  <div class="preview-template-overlay" :style="templateDesignStyle" />
                </div>
              </div>
              <div v-else class="preview-placeholder">
                Select surface to show preview
              </div>
            </template>
          </div>
          <ul class="spec-list">
            <li><span>Type</span><strong>{{ selectedSignStyle.label }}</strong></li>
            <li v-if="!isNoShapeFlow"><span>Shape</span><strong>{{ selectedShape.label }}</strong></li>
            <li v-if="!isNoShapeFlow"><span>Slate</span><strong>{{ selectedSlateColor.label }}</strong></li>
            <li v-if="isNoShapeFlow"><span>Template</span><strong>{{ selectedTemplate?.label }}</strong></li>
            <li><span>Total</span><strong>${{ totalPrice.toFixed(2) }}</strong></li>
          </ul>
        </aside>
      </div>

      <!-- ═══ Step 3: Design & Finish ═══ -->
      <div v-if="state.currentStep === 3" class="split-layout">
        <div class="panel-stack">
          <!-- Design Template (shown in Step 3 only for normal flow; moved to Step 2 when no size-shape) -->
          <section v-if="!isNoShapeFlow && hasSection('design-template')" class="panel" :class="{ 'panel-disabled': !canSelectTemplateStep3 }">
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
                >Regular</button>
              </div>
            </div>

            <p v-if="!availableDesignTemplates.length" class="template-empty">
              No templates are available for the selected sign style.
            </p>

            <!-- Filtered templates by active tier -->
            <div v-else-if="hasTiers" class="pill-grid template-grid">
              <button
                v-for="item in tieredTemplates"
                :key="item.id"
                type="button"
                class="tile template-tile"
                  :disabled="!canSelectTemplateStep3"
                :class="{ selected: state.templateId === item.id }"
                @click="state.templateId = item.id"
              >
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.label" class="template-thumb" />
                <span v-if="state.templateId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>

            <!-- Fallback: templates without tier grouping -->
            <div v-else class="pill-grid template-grid">
              <button
                v-for="item in availableDesignTemplates"
                :key="item.id"
                type="button"
                class="tile template-tile"
                  :disabled="!canSelectTemplateStep3"
                :class="{ selected: state.templateId === item.id }"
                 @click="state.templateId = item.id"
              >
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.label" class="template-thumb" />
                <!-- <span>{{ item.label }}</span> -->
              </button>
            </div>
          </section>

          <!-- Slate Color (moved to Step 3 when no size-shape flow) -->
          <section v-if="isNoShapeFlow && hasSection('slate-color')" class="panel slate-panel" :class="{ 'panel-disabled': !canSelectSlateStep3 }">
            <h3 class="panel-title-with-info">
              Slate Color
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <p v-if="selectedStyleSubtitle" class="panel-style-subtitle">{{ selectedStyleSubtitle }}</p>
            <div class="swatch-grid slate-grid">
              <button
                v-for="item in slateColors"
                :key="item.id"
                type="button"
                class="swatch slate-card"
                :disabled="!canSelectSlateStep3"
                :class="{ selected: state.slateColorId === item.id }"
                @click="state.slateColorId = item.id"
              >
                <span
                  class="swatch-chip slate-chip"
                  :style="{ backgroundImage: getSlateColorImageUrl(item, selectedShape.id) ? `url(${getSlateColorImageUrl(item, selectedShape.id)})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', width: '100%', height: '60px', borderRadius: '6px' }"
                />
                <span class="slate-label">{{ item.label }}</span>
                <small class="slate-price">${{ item.price.toFixed(2) }}</small>
                <span v-if="state.slateColorId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <!-- Paint Color (flow-dependent) -->
          <section v-if="hasSection('paint-color')" class="panel paint-panel" :class="{ 'panel-disabled': isNoShapeFlow ? !canSelectPaintStep3NoShape : !canSelectPaintStep3 }">
            <h3 class="panel-title-with-info">
              Paint Color
              <span class="info-dot" aria-hidden="true">i</span>
            </h3>
            <p v-if="selectedStyleSubtitle" class="panel-style-subtitle">{{ selectedStyleSubtitle }}</p>
            <div class="swatch-grid paint-grid">
              <button
                v-for="item in paintColors"
                :key="item.id"
                type="button"
                class="swatch paint-card"
                :disabled="isNoShapeFlow ? !canSelectPaintStep3NoShape : !canSelectPaintStep3"
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
                <span v-if="state.paintColorId === item.id" class="option-check" aria-hidden="true" />
              </button>
            </div>
          </section>

          <div class="footer-actions" v-if="state.currentStep > 1">
            <p v-if="stepError" class="step-error" role="alert">{{ stepError }}</p>
            <button type="button" class="ghost-btn" :disabled="isFirstStep || isNavigating" @click="prevStep">Back</button>
            <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
            <button v-if="!isLastStep" type="button" class="tf-primary-btn" :disabled="isNavigating" @click="handleNext">
              <span v-if="isNavigating" class="btn-spinner" aria-hidden="true"></span>
              <span v-else>Next</span>
            </button>
            <button v-else type="button" class="tf-primary-btn" :disabled="state.status === 'submitting'" @click="onSubmit">
              <span v-if="state.status === 'submitting'" class="btn-spinner" aria-hidden="true"></span>
              <span v-else>Next</span>
            </button>
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
          <div class="preview-canvas" :class="[selectedShape?.id, state.slateColorId]" :style="preview.surfaceStyle">
            <template v-if="isNoShapeFlow">
              <div v-if="templateImageUrl" class="preview-no-shape-sign" :style="noShapePreviewStyle">
                <div class="preview-template-wrapper" :style="templateWrapperStyle">
                  <div class="preview-paint-bg" :style="paintBackgroundStyle" />
                  <div class="preview-template-overlay" :style="templateDesignStyle" />
                </div>
              </div>
              <span v-else class="preview-no-template">Select a template to preview</span>
            </template>
            <template v-else>
              <div v-if="selectedShape?.id" class="preview-sign" :class="[selectedShape?.id, state.slateColorId]" :style="[preview.signStyle, getPreviewShapeStyle(selectedShape)]">
                <div v-if="templateImageUrl" class="preview-template-wrapper" :style="templateWrapperStyle">
                  <div class="preview-paint-bg" :style="paintBackgroundStyle" />
                  <div class="preview-template-overlay" :style="templateDesignStyle" />
                </div>
              </div>
              <div v-else class="preview-placeholder">
                Select surface to show preview
              </div>
            </template>
          </div>
          <ul class="spec-list">
            <li><span>Type</span><strong>{{ selectedSignStyle.label }}</strong></li>
            <li v-if="!isNoShapeFlow"><span>Shape</span><strong>{{ selectedShape.label }}</strong></li>
            <li v-if="!isNoShapeFlow"><span>Slate</span><strong>{{ selectedSlateColor.label }}</strong></li>
            <li v-if="isNoShapeFlow"><span>Template</span><strong>{{ selectedTemplate?.label }}</strong></li>
            <li><span>Paint</span><strong>{{ selectedPaintColor.label }}</strong></li>
            <li><span>Total</span><strong>${{ totalPrice.toFixed(2) }}</strong></li>
          </ul>
        </aside>
      </div>

      <!-- ═══ Step 4: Review & Next ═══ -->
      <div v-if="state.currentStep === 4" class="split-layout">
        <div class="panel-stack">
          <section class="panel review-panel"> 
            <p v-if="state.message && state.status === 'error'" class="form-error">{{ state.message }}</p>

            <div class="proof-section" :class="{ 'has-error': reviewErrors.requireProof }">
              <p class="proof-text">All signs are individually designed using classic stone cutter fonts to maximize readability. We will not create a sign that we feel is ugly or unreadable without your consent. You can trust our judgement or be absolutely certain of your decision by requesting a "proof" which we're happy to e-mail. Upon receipt of the proof you must respond within 48 hours to avoid the order being cancelled.</p>
              
              <div class="proof-options">
                <label class="proof-option">
                  <input type="radio" v-model="state.requireProof" value="Yes" @change="clearFieldError('requireProof')" />
                  <span class="proof-option-label">YES, I require proof before my sign goes into production</span>
                </label>
                <label class="proof-option">
                  <input type="radio" v-model="state.requireProof" value="No" @change="clearFieldError('requireProof')" />
                  <span class="proof-option-label">NO, I trust your judgement, please start carving my sign.</span>
                </label>
              </div>
              <small v-if="reviewErrors.requireProof" class="field-error">{{ reviewErrors.requireProof }}</small>
            </div>
            
            <label class="field-label">Design Template</label>
            <select v-select2="{ placeholder: 'Select design template' }" v-model="state.templateId" class="field-input">
              <option v-for="item in availableDesignTemplates" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

            <template v-for="field in reviewFields" :key="field.key">
              <label class="field-label" style="margin-top:0 ;">{{ field.label }}</label>
              <input
                v-model="state[field.key]"
                type="text"
                class="field-input"
                :class="{ 'has-error': reviewErrors[field.key] }"
                :placeholder="field.placeholder"
                @input="clearFieldError(field.key)"
              />
              <small v-if="reviewErrors[field.key]" class="field-error">{{ reviewErrors[field.key] }}</small>
            </template>

            <label class="field-label">Paint Color</label>
            <select v-select2="{ placeholder: 'Select paint color' }" v-model="state.paintColorId" class="field-input">
              <option v-for="item in paintColors" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

            <label class="field-label">Mounting Hardware</label>
            <select v-select2="{ placeholder: 'Select mounting hardware' }" v-model="state.hardwareId" class="field-input">
              <option v-for="item in mountingHardware" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>

            <label class="field-label">Add-ons</label>
            <select v-select2="{ placeholder: 'Select add-ons' }" v-model="state.addOnIds" class="field-input" multiple>
              <option v-for="item in addOns" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </section>
          
          <div class="footer-actions" v-if="state.currentStep > 1">
            <p v-if="stepError" class="step-error" role="alert">{{ stepError }}</p>
            <button type="button" class="ghost-btn" :disabled="isFirstStep || isNavigating" @click="prevStep">Back</button>
            <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
            <button v-if="!isLastStep" type="button" class="tf-primary-btn" :disabled="isNavigating" @click="handleNext">
              <span v-if="isNavigating" class="btn-spinner" aria-hidden="true"></span>
              <span v-else>Next</span>
            </button>
            <button v-else type="button" class="tf-primary-btn" :disabled="state.status === 'submitting'" @click="onSubmit">
              <span v-if="state.status === 'submitting'" class="btn-spinner" aria-hidden="true"></span>
              <span v-else>Next</span>
            </button>
          </div>
        </div>
        <aside class="preview-card summary-card">
          <header class="order-summary-header">Order Summary</header>
          <div ref="previewCaptureRef" class="preview-canvas" :class="selectedShape.id" :style="preview.surfaceStyle">
            <template v-if="isNoShapeFlow">
              <div v-if="templateImageUrl" class="preview-no-shape-sign" :style="noShapePreviewStyle">
                <div class="preview-template-wrapper" :style="templateWrapperStyle">
                  <div class="preview-paint-bg" :style="paintBackgroundStyle" />
                  <div class="preview-template-overlay" :style="templateDesignStyle" />
                </div>
              </div>
              <span v-else class="preview-no-template">Select a template to preview</span>
            </template>
            <template v-else>
              <div v-if="selectedShape?.id" class="preview-sign" :class="[selectedShape?.id, state.slateColorId]" :style="[preview.signStyle, getPreviewShapeStyle(selectedShape)]">
                <div v-if="templateImageUrl" class="preview-template-wrapper" :style="templateWrapperStyle">
                  <div class="preview-paint-bg" :style="paintBackgroundStyle" />
                  <div class="preview-template-overlay" :style="templateDesignStyle" />
                </div>
              </div>
              <div v-else class="preview-placeholder">
                Select surface to show preview
              </div>
            </template>
          </div> 
          
          <ul class="summary-list">
            <li class="summary-item"><span>Shape &amp; Size: <strong>{{ selectedShape.label }}</strong></span><strong>${{ (selectedShape.basePrice || 0).toFixed(2) }}</strong></li>
            <li class="summary-item"><span>Slate Color: <strong>{{ selectedSlateColor.label }}</strong></span><strong>${{ selectedSlateColor.price.toFixed(2) }}</strong></li>
            <li class="summary-item"><span>Template: <strong>{{ selectedTemplate?.label }}</strong></span><strong>Included</strong></li>
            <li class="summary-item"><span>Paint Color: <strong>{{ selectedPaintColor.label }}</strong></span><strong>Included</strong></li>
            <li class="divider"></li>
            <li v-for="addOn in selectedAddOns" :key="addOn.id" class="summary-item-main"><span><strong>{{ formatOptionLabel(addOn.label) }}</strong></span><strong>+${{ addOn.price.toFixed(2) }}</strong></li>
            <li class="summary-item-main"><span><strong>{{ formatOptionLabel(selectedHardware.label) }}</strong></span><strong>+${{ payload.pricing.hardware.toFixed(2) }}</strong></li>
          </ul> 
          <p class="final-total"><span>Total:</span><strong>${{ totalPrice.toFixed(2) }}</strong></p>
          <p class="summary-note">(before shipping &amp; taxes)</p>
        </aside>
      </div>

      <div class="footer-actions" v-if="state.currentStep == 1">
        <p v-if="stepError" class="step-error" role="alert">{{ stepError }}</p>
        <button type="button" class="ghost-btn" :disabled="isFirstStep || isNavigating" @click="prevStep">Back</button>
        <small class="footer-step">Step {{ state.currentStep }} of {{ totalSteps }}</small>
        <button v-if="!isLastStep" type="button" class="tf-primary-btn" :disabled="isNavigating" @click="handleNext">
          <span v-if="isNavigating" class="btn-spinner" aria-hidden="true"></span>
          <span v-else>Next</span>
        </button>
        <button v-else type="button" class="tf-primary-btn" :disabled="state.status === 'submitting'" @click="onSubmit">
          <span v-if="state.status === 'submitting'" class="btn-spinner" aria-hidden="true"></span>
          <span v-else>Next</span>
        </button>
      </div>

      <!-- <section class="payload-box">
        <h4>Configuration Object Output</h4>
        <pre>{{ formattedPayload }}</pre>
      </section> -->
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

.choice-card.selected .choice-icon-svg :deep(svg path) {
  stroke: #fff;
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
  grid-template-columns: 1fr 450px;
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
  text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15);
}

.panel-style-subtitle {
  margin: 2px 0 12px;
  color: #6b6b7a;
  font-size: 13px;
  line-height: 1.4;
}

.panel-disabled {
  opacity: 0.65;
}

.panel-disabled button {
  cursor: not-allowed;
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

.shape-preview.oval_cottage,
.shape-preview.oval {
  border-radius: 50%;
}

.shape-preview.arch {
  border-radius: 50%;
}
.shape-preview.arched,
.preview-sign.arched,
.slate-chip.arched {
  border-radius: 50% 50% 0% 0;
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

.slate-chip.oval_cottage,
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.template-empty {
  margin: 0;
  color: var(--Text-Paragraph, #4D4B58);
  font-size: 14px;
  line-height: 150%;
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
}

.preview-live-text {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.preview-line {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 86%;
  text-align: center;
  text-transform: uppercase;
  line-height: 1.1;
}

.preview-line.houseNumber {
  font-weight: 700;
}

.preview-line.topText,
.preview-line.bottomText {
  font-weight: 600;
}

.preview-canvas {
  border-radius: 10px;
  min-height: 293px; 
  /* width: 400px; */
  display: grid;
  place-items: center;
  border: 1px solid #d4d3de;
  margin-bottom: 10px;
  padding: 16px; 
}

.preview-sign {
  position: relative;
  isolation: isolate;
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; 
  color: #f8f2d8;
 
}

.preview-sign.oval_cottage,
.preview-sign.oval {
  border-radius: 90%;
}

.preview-sign.rectangle {
  border-radius: 4px;
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

.field-input.has-error {
  border-color: #d14343;
  box-shadow: 0 0 0 1px rgba(209, 67, 67, 0.14);
}

.field-help {
  margin: 0 0 12px;
  color: var(--Text-Paragraph, #4D4B58);
  font-size: 13px;
  line-height: 150%;
}

.field-error {
  display: block;
  margin-top: 4px;
  color: #b42318;
  font-size: 12px;
  line-height: 150%;
}

.form-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid #f1b4b4;
  border-radius: 8px;
  background: #fff1f1;
  color: #b42318;
  font-size: 13px;
  line-height: 150%;
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
  margin-bottom: 0 !important;
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

  .pill-grid.template-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
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

  .pill-grid.template-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

@keyframes ss-spin {
  to { transform: rotate(360deg); }
}

.step-error {
  color: #c0392b;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px;
  background: #fdf0ef;
  border: 1px solid #f5c6c2;
  border-radius: 6px;
  margin: 0;
  width: 100%;
  grid-column: 1 / -1;
  text-align: center;
}

.btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ss-spin 0.6s linear infinite;
  vertical-align: middle;
}

.tf-primary-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* ── No-shape-flow template preview ─────────────────────────────────── */
.preview-no-shape-sign {
  position: relative;
  isolation: isolate;
  width: min(100%, 280px);
  height: auto;
  border-radius: 10px;
  /* border: 2px solid rgba(0, 0, 0, 0.18); */
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.preview-no-template,
.preview-placeholder {
  color: #a8a6b8;
  font-size: 14px;
  text-align: center;
  padding: 24px 16px;
}

/* ── Proof Section ────────────────────────────────── */
.proof-section {
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(111, 98, 166, 0.04);
  border-radius: 12px;
  border: 1px solid var(--line);
}

.proof-section.has-error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.02);
}

.proof-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  margin-bottom: 20px;
}

.proof-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proof-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid var(--line);
  transition: all 0.2s ease;
}

.proof-option:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.proof-option input[type="radio"] {
  margin-top: 3px;
  accent-color: var(--accent);
}

.proof-option-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
}
</style>

<style>
/* ── Select2 theme: sign-selector ─────────────────────────────────────── */
.select2-container--sign-selector .select2-selection--single,
.select2-container--sign-selector .select2-selection--multiple {
  border: 1px solid #d4d4c4;
  border-radius: 8px;
  background: #fff;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  font-size: 14px;
  font-family: inherit;
  color: #302f37;
  box-sizing: border-box;
  cursor: pointer;
}

/* Single: reserve right padding for the arrow */
.select2-container--sign-selector .select2-selection--single { 
  position: relative;
}

/* Multiple: reserve right padding for the down-caret */
.select2-container--sign-selector .select2-selection--multiple {
  padding-right: 36px;
  position: relative;
}

/* Down-caret for multiple (Select2 doesn't render one itself) */
.select2-container--sign-selector .select2-selection--multiple::after {
  content: '';
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  pointer-events: none;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%23675d9a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat center / 14px 14px;
}

.select2-container--sign-selector.select2-container--focus .select2-selection--single,
.select2-container--sign-selector.select2-container--focus .select2-selection--multiple,
.select2-container--sign-selector.select2-container--open .select2-selection--single,
.select2-container--sign-selector.select2-container--open .select2-selection--multiple {
  border-color: #675d9a;
  outline: none;
  box-shadow: 0 0 0 3px rgba(103, 93, 154, 0.15);
}

/* Rotate caret on open for multiple */
.select2-container--sign-selector.select2-container--open .select2-selection--multiple::after {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 10l4-4 4 4' stroke='%23675d9a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.select2-container--sign-selector .select2-selection--single .select2-selection__rendered {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  padding: 0 4px;
  color: #302f37;
}

/* Placeholder colour */
.select2-container--sign-selector .select2-selection--single .select2-selection__placeholder {
  color: #a0a0a0;
}

.select2-container--sign-selector .select2-selection--single .select2-selection__arrow {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%23675d9a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat center / 14px 14px;
}

.select2-container--sign-selector.select2-container--open .select2-selection--single .select2-selection__arrow {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 10l4-4 4 4' stroke='%23675d9a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

/* Hide the native <b> triangle - we use the SVG above instead */
.select2-container--sign-selector .select2-selection--single .select2-selection__arrow b {
  display: none;
}
.preview-no-shape-sign {
	border-radius: 50% !important;
}
/* Multiple selection tokens */
.select2-container--sign-selector .select2-selection--multiple .select2-selection__choice {
  /* background: #675d9a; */
  border: none;
  border-radius: 4px; 
  font-size: 13px;
  padding: 2px 8px 2px 6px;
  margin: 2px 4px 2px 0;
}

.select2-container--sign-selector .select2-selection--multiple .select2-selection__choice__remove {
  display: none;
}

/* .select2-container--sign-selector .select2-selection--multiple .select2-selection__choice__remove:hover {
  color: #fff;
} */

.select2-container--sign-selector .select2-selection--multiple .select2-selection__rendered {
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.select2-container--sign-selector .select2-selection--multiple .select2-search--inline .select2-search__field {
  font-family: inherit;
  font-size: 14px;
  color: #302f37;
  margin: 0;
  height: 28px;
}

/* Dropdown */
.select2-container--sign-selector .select2-dropdown {
  border: 1px solid #d4d4c4;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  background: #fff;
}

/* Keep long option lists scrollable instead of stretching the dropdown */
.select2-container--sign-selector .select2-results > .select2-results__options {
  max-height: 280px !important;
  overflow-y: auto !important;
}

.select2-container--sign-selector .select2-search--dropdown .select2-search__field {
  border: 1px solid #d4d4c4;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
}

.select2-container--sign-selector .select2-search--dropdown .select2-search__field:focus {
  border-color: #675d9a;
}

.select2-container--sign-selector .select2-results__option {
  padding: 8px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #302f37;
  cursor: pointer;
}

.select2-container--sign-selector .select2-results__option--highlighted {
  background: #f0eeff;
  color: #675d9a;
}

.select2-container--sign-selector .select2-results__option[aria-selected="true"] {
  background: #675d9a;
  color: #fff;
}

.select2-container--sign-selector .select2-results__option[aria-selected="true"]:hover,
.select2-container--sign-selector .select2-results__option[aria-selected="true"].select2-results__option--highlighted {
  background: #5a508a;
}

/* Keep native select hidden but let Select2 take its width */
.field-input.select2-hidden-accessible {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  clip: rect(0 0 0 0) !important;
  white-space: nowrap !important;
}

/* comment for future */
/* .preview-canvas.arch {
	background-size: 105% !important;
} */

/* .preview-canvas.round {
	background-size: 125% !important;
} */
.preview-sign.round .preview-template-overlay {
	background-size: 105% !important;
}
.preview-sign.oval .preview-template-overlay {
	background-size: 102% !important;
}
.preview-no-shape-sign .preview-template-overlay {
	background-size: 102% !important;
}

.proof-section {
  background: var(--bg);
  border: 1px solid var(--line);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}
.proof-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
  margin: 0 0 16px 0;
}
.proof-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}
.proof-checkbox input {
  margin-top: 3px;
  cursor: pointer;
}
.select2-selection__rendered {
	margin: 0 !important;
}
.preview-sign.rectangle.green {
	background-size: 111% !important;
}
.preview-sign.oval.mottle-black {
	background-size: 106% !important;
}
.preview-sign.oval.mottle-black {
	background-size: 114% !important;
}
.preview-sign.arched.green {
	background-size: 112% !important;
}
.preview-sign.round {
	height: 260px !important;
}
.preview-sign {
	filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.64));
}
</style>
