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

const stepDefinitions      = toArray(cfg.steps)
const signStyles           = toArray(cfg.signStyles)
const shapes               = toArray(cfg.shapes).map(s => ({ ...s, basePrice: Number(s.basePrice) || 0, width: Number(s.width) || 0, height: Number(s.height) || 0 }))
const addOns               = toArray(cfg.addons).map(a => ({ ...a, price: Number(a.price) || 0 }))
const mountingHardware     = toArray(cfg.mountingHardware).map(h => ({ ...h, price: Number(h.price) || 0 }))

const installationSurfaces = toArray(cfg.surfaces).map(s => ({
  ...s,
  imageUrl: s.imageUrl || ''
}))

const slateColors = toArray(cfg.slateColors).map(item => ({
  ...item,
  price: Number(item.price) || 0,
  images: item.images || {},
  imageUrl: item.imageUrl || (item.images && item.images.default) || ''
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
  imageUrl: p.imageUrl || ''
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

const getTemplatesForSelection = (shapeId, signStyleId) => {
  const normalizedShapeId = normalizeShapeId(shapeId)
  const normalizedStyleId = normalizeStyleId(signStyleId)

  return designTemplates.filter((item) => {
    const itemShapeId = normalizeShapeId(item.shapeId) || 'all'
    const shapeMatches = itemShapeId === 'all' || itemShapeId === normalizedShapeId

    const assignedStyleIds = Array.isArray(item.signStyleIds)
      ? item.signStyleIds.map(normalizeStyleId).filter(Boolean)
      : null
    const styleMatches = !Array.isArray(assignedStyleIds)
      ? true
      : assignedStyleIds.includes(normalizedStyleId)

    return shapeMatches && styleMatches
  })
}

export const useSignSelectorState = () => {
  const initialShapeId = resolveInitialId(shapes, initialConfiguration?.sign?.shape?.id, shapes[0]?.id || '')
  const initialSignStyleId = resolveInitialId(signStyles, initialConfiguration?.sign?.style?.id, signStyles[0]?.id || '')
  const initialTemplates = getTemplatesForSelection(initialShapeId, initialSignStyleId)

  const state = reactive({
    currentStep: 1,
    signStyleId: initialSignStyleId,
    surfaceId: resolveInitialId(installationSurfaces, initialConfiguration?.sign?.surface?.id, installationSurfaces[0]?.id || ''),
    shapeId: initialShapeId,
    slateColorId: resolveInitialId(slateColors, initialConfiguration?.sign?.slateColor?.id, slateColors[0]?.id || ''),
    templateId: resolveInitialId(initialTemplates, initialConfiguration?.sign?.template?.id, initialTemplates[0]?.id || ''),
    paintColorId: resolveInitialId(paintColors, initialConfiguration?.sign?.paintColor?.id, paintColors[0]?.id || ''),
    addOnId: resolveInitialId(addOns, initialConfiguration?.sign?.addOn?.id, addOns[0]?.id || ''),
    hardwareId: resolveInitialId(mountingHardware, initialConfiguration?.sign?.hardware?.id, mountingHardware[0]?.id || ''),
    topText: initialConfiguration?.checkout?.topText || '',
    houseNumber: initialConfiguration?.checkout?.houseNumber || '',
    bottomText: initialConfiguration?.checkout?.bottomText || '',
    editCartItemKey: frontendConfigRaw.editCartItemKey || initialConfiguration?.checkout?.editCartItemKey || '',
    status: 'idle',
    message: ''
  })

  const selectedSignStyle = computed(() => safeFind(signStyles, state.signStyleId))
  const selectedSurface = computed(() => safeFind(installationSurfaces, state.surfaceId))
  const selectedShape = computed(() => safeFind(shapes, state.shapeId))
  const selectedSlateColor = computed(() => safeFind(slateColors, state.slateColorId))
  const availableDesignTemplates = computed(() => getTemplatesForSelection(state.shapeId, state.signStyleId))
  const selectedTemplate = computed(() => safeFind(availableDesignTemplates.value, state.templateId) || { id: '', label: '', price: 0, imageUrl: '' })
  const selectedPaintColor = computed(() => safeFind(paintColors, state.paintColorId))
  const selectedAddOn = computed(() => safeFind(addOns, state.addOnId))
  const selectedHardware = computed(() => safeFind(mountingHardware, state.hardwareId))

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
    return (
      (selectedShape.value?.basePrice || 0) +
      (selectedSlateColor.value?.price || 0) +
      (selectedAddOn.value?.price || 0) +
      (selectedHardware.value?.price || 0)
    )
  })

  const preview = computed(() => ({
    surfaceStyle: {
      backgroundImage: selectedSurface.value.imageUrl
        ? `linear-gradient(0deg, rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.14)), url("${selectedSurface.value.imageUrl}")`
        : 'linear-gradient(130deg, #d9c9a8, #e8dcc3 45%, #cab48d 80%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    signStyle: {
      backgroundColor: selectedSlateColor.value?.hex || '#2b3239',
      backgroundImage: (selectedSlateColor.value.images?.[selectedShape.value.id] || selectedSlateColor.value.imageUrl)
        ? `linear-gradient(0deg, rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.14)), url("${selectedSlateColor.value.images?.[selectedShape.value.id] || selectedSlateColor.value.imageUrl}")`
        : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      color: selectedPaintColor.value.hex,
      boxShadow: '0 14px 28px rgba(0,0,0,0.25)'
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
      addOn: selectedAddOn.value,
      hardware: selectedHardware.value
    },
    pricing: {
      base: selectedShape.value.basePrice,
      slate: selectedSlateColor.value.price,
      template: 0,
      paint: 0,
      addOn: selectedAddOn.value.price,
      hardware: selectedHardware.value.price,
      total: totalPrice.value
    },
    checkout: {
      step: state.currentStep,
      topText: state.topText,
      houseNumber: state.houseNumber,
      bottomText: state.bottomText,
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
    const matchingTemplates = availableDesignTemplates.value

    if (!matchingTemplates.length) {
      state.templateId = ''
      return
    }

    if (!matchingTemplates.some((item) => item.id === state.templateId)) {
      state.templateId = matchingTemplates[0].id
    }
  }, { immediate: true })

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
    slateColors,
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
    selectedAddOn,
    selectedHardware,
    totalPrice,
    preview,
    payload,
    isFirstStep: computed(() => state.currentStep === 1),
    isLastStep: computed(() => state.currentStep === totalSteps.value),
    setStep,
    nextStep,
    prevStep,
    submitConfiguration
  }
}