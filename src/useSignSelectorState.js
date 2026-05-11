import axios from 'axios'
import { computed, reactive, watch } from 'vue'

/* ─── Read admin-managed configurator data from backend ──────────────── */

const frontendConfigRaw = window.SIGN_SELECTOR_CONFIG || {}
const cfg = frontendConfigRaw.configurator || {}

const getPluginDirectoryUrl = () => {
  const value = frontendConfigRaw.plugin_directory_url || ''
  if (!value) return ''
  return value.endsWith('/') ? value : `${value}/`
}

const pluginDirectoryUrl = getPluginDirectoryUrl()

/* ─── All data comes from admin-saved configuration (no hardcoded fallbacks) ── */

const toArray = (val) => (Array.isArray(val) ? val : [])
const normalizeShapeId = (val) => (typeof val === 'string' ? val.trim().toLowerCase() : '')
const normalizeStyleId = (val) => (typeof val === 'string' ? val.trim().toLowerCase() : '')

const stepDefinitions = toArray(cfg.steps)
const signStyles = toArray(cfg.signStyles)
const allShapes = toArray(cfg.shapes).map(s => ({
  ...s,
  basePrice: Number(s.basePrice) || 0,
  width: Number(s.width) || 0,
  height: Number(s.height) || 0,
  signStyleIds: Array.isArray(s.signStyleIds) ? s.signStyleIds.map(normalizeStyleId).filter(Boolean) : null
}))
const addOns = toArray(cfg.addons).map(a => ({ ...a, price: Number(a.price) || 0, isDefault: Boolean(a.isDefault) }))
const mountingHardware = toArray(cfg.mountingHardware).map(h => ({ ...h, price: Number(h.price) || 0, isDefault: Boolean(h.isDefault) }))

const allInstallationSurfaces = toArray(cfg.surfaces).map(s => ({
  ...s,
  imageUrl: s.imageUrl || '',
  isDefault: Boolean(s.isDefault),
  signStyleIds: Array.isArray(s.signStyleIds) ? s.signStyleIds.map(normalizeStyleId).filter(Boolean) : null
}))

const slateColors = toArray(cfg.slateColors).map(item => ({
  ...item,
  price: Number(item.price) || 0,
  shapeIds: Array.isArray(item.shapeIds) ? item.shapeIds.map(normalizeShapeId).filter(Boolean) : null,
  images: item.images || {},
  imageUrl: item.imageUrl || (item.images && item.images.default) || '',
  isDefault: Boolean(item.isDefault)
}))

const designTemplates = toArray(cfg.designTemplates).map(t => ({
  ...t,
  price: 0,
  imageUrl: t.imageUrl || '',
  textLayout: typeof t.textLayout === 'string' ? t.textLayout : '',
  fields: Array.isArray(t.fields) ? t.fields : [],
  shapeId: normalizeShapeId(t.shapeId) || 'all',
  signStyleIds: Array.isArray(t.signStyleIds) ? t.signStyleIds.map(normalizeStyleId).filter(Boolean) : null
}))

const paintColors = toArray(cfg.paintColors).map(p => ({
  ...p,
  price: 0,
  imageUrl: p.imageUrl || '',
  isDefault: Boolean(p.isDefault)
}))

/* ─── Flow section definitions from admin ────────────────────────────── */

const flowSectionLabels = cfg.flowSections || {
  'installation-surface': 'Installation Surface',
  'size-shape': 'Size & Shape',
  'slate-color': 'Slate Color',
  'design-template': 'Design Template',
  'paint-color': 'Paint Color',
}

const defaultFlowIds = Object.keys(flowSectionLabels)

const safeFind = (arr, id) => arr.find((item) => item.id === id) || arr[0]

const initialConfiguration =
  frontendConfigRaw.initialConfiguration && typeof frontendConfigRaw.initialConfiguration === 'object'
    ? frontendConfigRaw.initialConfiguration
    : {}

const resolveInitialId = (arr, candidate, fallbackId) => {

  if (candidate && arr.some((item) => item.id === candidate)) {
    return candidate
  }

  return fallbackId
}

const resolveDefaultSurfaceId = (surfaces, candidate) => {
  if (candidate && surfaces.some((item) => item.id === candidate)) {
    return candidate
  }

  const defaultSurface = surfaces.find(s => s.isDefault)
  if (defaultSurface) {
    return defaultSurface.id
  }

  return ''
}

const resolveDefaultSlateColorId = (slates, candidate) => {
  if (candidate && slates.some((item) => item.id === candidate)) {
    return candidate
  }

  const defaultSlate = slates.find(s => s.isDefault)
  if (defaultSlate) {
    return defaultSlate.id
  }

  return ''
}

const resolveDefaultPaintId = (paints, candidate) => {
  if (candidate && paints.some((item) => item.id === candidate)) {
    return candidate
  }

  const defaultPaint = paints.find(p => p.isDefault)
  if (defaultPaint) {
    return defaultPaint.id
  }

  return paints[0]?.id || ''
}

const getTemplatesForSelection = (shapeId, signStyleId, ignoreShape = false) => {
  const normalizedShapeId = normalizeShapeId(shapeId)
  const normalizedStyleId = normalizeStyleId(signStyleId)

  return designTemplates.filter((item) => {
    if (!ignoreShape) {
      const itemShapeId = normalizeShapeId(item.shapeId) || 'all'
      const shapeMatches = itemShapeId === 'all' || itemShapeId === 'none' || itemShapeId === normalizedShapeId
      if (!shapeMatches) return false
    }

    const assignedStyleIds = Array.isArray(item.signStyleIds)
      ? item.signStyleIds.map(normalizeStyleId).filter(Boolean)
      : null
    const styleMatches = !Array.isArray(assignedStyleIds)
      ? true
      : assignedStyleIds.includes(normalizedStyleId)

    return styleMatches
  })
}

const getShapesForSignStyle = (signStyleId) => {
  const normalizedStyleId = normalizeStyleId(signStyleId)

  return allShapes.filter((item) => {
    const assignedStyleIds = Array.isArray(item.signStyleIds)
      ? item.signStyleIds.map(normalizeStyleId).filter(Boolean)
      : null
    const styleMatches = !Array.isArray(assignedStyleIds)
      ? true
      : assignedStyleIds.includes(normalizedStyleId)

    return styleMatches
  })
}

const getSurfacesForSignStyle = (signStyleId) => {
  const normalizedStyleId = normalizeStyleId(signStyleId)

  return allInstallationSurfaces.filter((item) => {
    const assignedStyleIds = Array.isArray(item.signStyleIds)
      ? item.signStyleIds.map(normalizeStyleId).filter(Boolean)
      : null
    const styleMatches = !Array.isArray(assignedStyleIds)
      ? true
      : assignedStyleIds.includes(normalizedStyleId)

    return styleMatches
  })
}

const getSlateColorImageUrl = (slateColor, shapeId) => {
  if (!slateColor || typeof slateColor !== 'object') return ''

  const normalizedShapeId = normalizeShapeId(shapeId)
  const shapeImages = slateColor.images && typeof slateColor.images === 'object' ? slateColor.images : {}

  if (normalizedShapeId && shapeImages[normalizedShapeId]) {
    return shapeImages[normalizedShapeId]
  }

  return slateColor.imageUrl || shapeImages.default || ''
}

const getSlateColorsForShape = (shapeId) => {
  const normalizedShapeId = normalizeShapeId(shapeId)

  return slateColors.filter((item) => {
    if (!Array.isArray(item.shapeIds)) {
      return true
    }

    if (!normalizedShapeId) {
      return item.shapeIds.length > 0
    }

    return item.shapeIds.includes(normalizedShapeId)
  })
}

export const useSignSelectorState = () => {
  const initialSignStyleId = resolveInitialId(signStyles, initialConfiguration?.sign?.style?.id, signStyles[0]?.id || '')
  const initialShapes = getShapesForSignStyle(initialSignStyleId)
  const initialShapeId = resolveInitialId(initialShapes, initialConfiguration?.sign?.shape?.id, initialShapes[0]?.id || '')
  const initialSurfaces = getSurfacesForSignStyle(initialSignStyleId)
  const initialSurfaceId = resolveDefaultSurfaceId(initialSurfaces, initialConfiguration?.sign?.surface?.id)
  const initialTemplates = getTemplatesForSelection(initialShapeId, initialSignStyleId);
  const initialSlateColors = getSlateColorsForShape(initialShapeId)
  const initialSlateColorId = resolveDefaultSlateColorId(initialSlateColors, initialConfiguration?.sign?.slateColor?.id)
 
  const state = reactive({
    currentStep: 1,
    signStyleId: initialConfiguration?.sign?.style?.id || '',
    surfaceId: initialSurfaceId,
    shapeId: initialConfiguration?.sign?.shape?.id || '',
    slateColorId: initialSlateColorId,
    templateId: initialConfiguration?.sign?.template?.id || '',
    paintColorId: resolveDefaultPaintId(paintColors, initialConfiguration?.sign?.paintColor?.id),
    addOnIds: Array.isArray(initialConfiguration?.sign?.addOns) && initialConfiguration.sign.addOns.length > 0
      ? initialConfiguration.sign.addOns.map(a => a.id).filter(Boolean)
      : addOns.filter(a => a.isDefault).map(a => a.id),
    hardwareId: initialConfiguration?.sign?.hardware?.id || (mountingHardware.find(h => h.isDefault)?.id || ''),
    requireProof: initialConfiguration?.checkout?.requireProof || '',
    firstLine: initialConfiguration?.checkout?.firstLine || '',
    secondLine: initialConfiguration?.checkout?.secondLine || '',
    topText: initialConfiguration?.checkout?.topText || '',
    houseNumber: initialConfiguration?.checkout?.houseNumber || '',
    bottomText: initialConfiguration?.checkout?.bottomText || '',
    editCartItemKey: frontendConfigRaw.editCartItemKey || initialConfiguration?.checkout?.editCartItemKey || '',
    status: 'idle',
    message: ''
  })

  const selectedSignStyle = computed(() => state.signStyleId ? (signStyles.find(i => i.id === state.signStyleId) || null) : null)
  const shapes = computed(() => getShapesForSignStyle(state.signStyleId))
  const installationSurfaces = computed(() => getSurfacesForSignStyle(state.signStyleId))
  const availableSlateColors = computed(() => getSlateColorsForShape(state.shapeId))
  const selectedSurface = computed(() => state.surfaceId ? (installationSurfaces.value.find(i => i.id === state.surfaceId) || {}) : {})
  const selectedShape = computed(() => state.shapeId ? (shapes.value.find(i => i.id === state.shapeId) || {}) : {})
  const selectedSlateColor = computed(() => state.slateColorId ? (availableSlateColors.value.find(i => i.id === state.slateColorId) || { price: 0, images: {}, imageUrl: '', hex: '' }) : { price: 0, images: {}, imageUrl: '', hex: '' })
  const availableDesignTemplates = computed(() => {
    const ignoreShape = !activeFlow.value.includes('size-shape')
    return getTemplatesForSelection(state.shapeId, state.signStyleId, ignoreShape)
  })
  const selectedTemplate = computed(() => state.templateId ? (availableDesignTemplates.value.find(i => i.id === state.templateId) || { id: '', label: '', price: 0, imageUrl: '' }) : { id: '', label: '', price: 0, imageUrl: '' })
  const selectedPaintColor = computed(() => state.paintColorId ? (paintColors.find(i => i.id === state.paintColorId) || { price: 0, imageUrl: '', hex: '' }) : { price: 0, imageUrl: '', hex: '' })
  const selectedAddOns = computed(() => addOns.filter(a => state.addOnIds.includes(a.id)))
  const selectedHardware = computed(() => state.hardwareId ? (mountingHardware.find(i => i.id === state.hardwareId) || { price: 0 }) : { price: 0 })

  /* ─── Per-product flow ─────────────────────────────────────────────── */

  /**
   * Steps are always fixed (from stepDefinitions, typically 4).
   * The sign style's `flow` array controls which *sections* inside each
   * step are visible.
   *
   * Step 1: Sign Style (always)
   * Step 2: Installation Surface + Size & Shape + Slate Color
   * Step 3: Design Template + Paint Color
   * Step 4: Review (always)
   */
  const totalSteps = computed(() => stepDefinitions.length || 4)

  /** The active flow section ids for the selected sign style */
  const activeFlow = computed(() => {
    const style = selectedSignStyle.value || {}
    const raw = Array.isArray(style.flow) && style.flow.length ? style.flow : defaultFlowIds
    return raw.filter(id => id !== 'review')
  })

  /** Does the current sign style's flow include a particular section? */
  const hasSection = (sectionId) => {
    return activeFlow.value.includes(sectionId)
  }

  const totalPrice = computed(() => {
    const addOnsTotal = selectedAddOns.value.reduce((sum, a) => sum + (a.price || 0), 0)
    return (
      (selectedShape.value?.basePrice || 0) +
      (selectedSlateColor.value?.price || 0) +
      addOnsTotal +
      (selectedHardware.value?.price || 0)
    )
  })

  const preview = computed(() => ({
    surfaceStyle: {
      backgroundImage: selectedSurface.value.imageUrl
        ? `url("${selectedSurface.value.imageUrl}")`
        : 'none',
      backgroundSize: '160% auto',
      backgroundPosition: 'left -78px',
      backgroundRepeat: 'no-repeat'
    },
    signStyle: {
      backgroundColor: selectedSlateColor.value?.hex || '#2b3239',
      backgroundImage: getSlateColorImageUrl(selectedSlateColor.value, selectedShape.value.id)
        ? `url("${getSlateColorImageUrl(selectedSlateColor.value, selectedShape.value.id)}")`
        : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      color: selectedPaintColor.value.hex,
      // boxShadow: '0 14px 28px rgba(0,0,0,0.25)'
    },
    textStyle: selectedPaintColor.value.imageUrl
      ? {
        color: selectedPaintColor.value.hex,
        backgroundImage: `url("${selectedPaintColor.value.imageUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: 'none'
      }
      : {
        color: selectedPaintColor.value.hex
      }
  }))

  const payload = computed(() => ({
    sign: {
      style: selectedSignStyle.value,
      surface: selectedSurface.value,
      shape: selectedShape.value,
      slateColor: selectedSlateColor.value,
      template: selectedTemplate.value,
      paintColor: selectedPaintColor.value,
      addOns: selectedAddOns.value,
      hardware: selectedHardware.value
    },
    pricing: {
      base: selectedShape.value.basePrice,
      slate: selectedSlateColor.value.price,
      template: 0,
      paint: 0,
      addOns: selectedAddOns.value.reduce((sum, a) => sum + (a.price || 0), 0),
      hardware: selectedHardware.value.price,
      total: totalPrice.value
    },
    checkout: {
      step: state.currentStep,
      firstLine: state.firstLine,
      secondLine: state.secondLine,
      topText: state.topText,
      houseNumber: state.houseNumber,
      bottomText: state.bottomText,
      requireProof: state.requireProof,
      editCartItemKey: state.editCartItemKey,
      createdAt: new Date().toISOString()
    }
  }))

  watch(
    payload,
    (value) => {
      window.signSelectorPayload = value
      window.dispatchEvent(new CustomEvent('sign-selector:updated', { detail: value }))
    },
    { immediate: true }
  )

  const setStep = (step) => {
    state.currentStep = Math.min(totalSteps.value, Math.max(1, Number(step) || 1))
  }

  const nextStep = () => setStep(state.currentStep + 1)
  const prevStep = () => setStep(state.currentStep - 1)

  watch([() => state.shapeId, () => state.signStyleId], () => {
    if (!state.signStyleId) return
    const ignoreShape = !activeFlow.value.includes('size-shape')
    const matchingTemplates = getTemplatesForSelection(state.shapeId, state.signStyleId, ignoreShape)

    // Only clear templateId if the current one is no longer valid — never auto-select
    if (state.templateId && !matchingTemplates.some((item) => item.id === state.templateId)) {
      state.templateId = ''
    }

    if (!availableSlateColors.value.some((item) => item.id === state.slateColorId)) {
      state.slateColorId = resolveDefaultSlateColorId(availableSlateColors.value, '')
    }
  })

  watch(() => state.signStyleId, () => {
    if (!state.signStyleId) return
    const matchingShapes = shapes.value

    // Only clear shapeId if it is no longer valid — never auto-select
    if (state.shapeId && !matchingShapes.some((item) => item.id === state.shapeId)) {
      state.shapeId = ''
    }
  })

  watch(() => state.signStyleId, () => {
    if (!state.signStyleId) return
    const matchingSurfaces = installationSurfaces.value

    if (!matchingSurfaces.length) {
      state.surfaceId = ''
      return
    }

    if (!matchingSurfaces.some((item) => item.id === state.surfaceId)) {
      state.surfaceId = resolveDefaultSurfaceId(matchingSurfaces, '')
    }
  })

  // When the user switches sign style the flow may have fewer steps;
  // clamp currentStep so it never exceeds the new total.
  watch(() => state.signStyleId, () => {
    if (state.currentStep > totalSteps.value) {
      state.currentStep = totalSteps.value
    }
  })

  const submitConfiguration = async (options = {}) => {
    const config = frontendConfigRaw
    if (!config.ajaxUrl || !config.action) {
      state.status = 'error'
      state.message = 'Backend endpoint is not configured.'
      return
    }

    state.status = 'submitting'
    state.message = ''

    const submissionPayload = {
      ...payload.value,
      checkout: {
        ...payload.value.checkout,
        ...(options.checkoutOverrides || {}),
        previewImageUrl: options.previewImageUrl || '',
        previewImageDataUrl: options.previewImageDataUrl || '',
        previewImageName: options.previewImageName || ''
      }
    }

    const formData = new FormData()
    formData.append('action', config.action)
    formData.append('nonce', config.nonce || '')
    formData.append('configuration', JSON.stringify(submissionPayload))

    try {
      const response = await axios.post(config.ajaxUrl, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const result = response?.data || {}

      if (!result.success) {
        throw new Error(result?.data?.message || 'Could not save configuration')
      }

      state.status = 'success'
      state.message = 'Configuration sent successfully.'

      const cartUrl = result?.data?.cartUrl || config.cartUrl
      if (cartUrl) {
        window.location.href = cartUrl
      }
    } catch (error) {
      state.status = 'error'
      state.message = error?.response?.data?.data?.message || (error instanceof Error ? error.message : 'Request failed.')
    }
  }

  return {
    stepDefinitions,
    hasSection,
    totalSteps,
    state,
    signStyles,
    installationSurfaces,
    shapes,
    slateColors: availableSlateColors,
    designTemplates,
    availableDesignTemplates,
    paintColors,
    addOns,
    mountingHardware,
    selectedSignStyle,
    selectedSurface,
    selectedShape,
    selectedSlateColor,
    selectedTemplate,
    selectedPaintColor,
    selectedAddOns,
    selectedHardware,
    totalPrice,
    preview,
    payload,
    getSlateColorImageUrl,
    isFirstStep: computed(() => state.currentStep === 1),
    isLastStep: computed(() => state.currentStep === totalSteps.value),
    setStep,
    nextStep,
    prevStep,
    submitConfiguration
  }
}