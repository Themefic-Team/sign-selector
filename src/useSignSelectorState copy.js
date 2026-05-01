import axios from 'axios'
import { computed, reactive, watch } from 'vue'

const getPluginDirectoryUrl = () => {
  const value = window.SIGN_SELECTOR_CONFIG?.plugin_directory_url || ''
  if (!value) {
    return ''
  }

  return value.endsWith('/') ? value : `${value}/`
}

const pluginDirectoryUrl = getPluginDirectoryUrl()
const installationSurfaceImageBase = `${pluginDirectoryUrl}assets/images/installation-surface/`
const slateImageBase = `${pluginDirectoryUrl}assets/images/slate/`
const paintImageBase = `${pluginDirectoryUrl}assets/images/paint/`

const slateBaseFiles = {
  black: 'slate_black.jpg',
  'mottle-black': 'slate_mottledblack.jpg',
  gray: 'slate_grey.jpg',
  green: 'slate_green.jpg',
  red: 'slate_red.jpg',
  variegated: 'slate_variegated.jpg',
  burgundy: 'slate_burgundy.jpg'
}

const slateShapeFiles = {
  rectangle: {
    gray: '10x13grey.jpg',
    green: '10x13green.jpg',
    red: '10x13red.jpg',
    variegated: '10x13variegated.jpg',
    burgundy: '10x13burgundy.jpg'
  },
  arch: {
    black: '12x24black.jpg',
    gray: '12x24grey.jpg',
    green: '12x24green.jpg'
  }
}

const getSlateImageSet = (colorId) => {
  const defaultFile = slateBaseFiles[colorId]
  const defaultUrl = defaultFile ? `${slateImageBase}${defaultFile}` : ''

  return {
    default: defaultUrl,
    rectangle: `${slateImageBase}${slateShapeFiles.rectangle[colorId] || defaultFile}`,
    oval: defaultUrl,
    round: defaultUrl,
    arch: `${slateImageBase}${slateShapeFiles.arch[colorId] || defaultFile}`
  }
}

const stepDefinitions = [
  {
    id: 1,
    title: 'Select Sign Style',
    heading: 'Select a Sign Style',
    subheading: 'Choose the purpose of your sign'
  },
  {
    id: 2,
    title: 'Shape, Size & Slate',
    heading: 'Select Shape, Size & Slate',
    subheading: 'Set the size and base material of your sign'
  },
  {
    id: 3,
    title: 'Design & Finish',
    heading: 'Choose Design & Finish',
    subheading: 'Select a layout and engraving color'
  },
  {
    id: 4,
    title: 'Review & Add',
    heading: 'Review Your Sign',
    subheading: 'Confirm details before adding to cart'
  }
]

const signStyles = [
  { id: 'home-address', label: 'Home Address', description: 'For displaying your house number', icon: '🏠' },
  { id: 'cottage', label: 'Cottage', description: 'Ideal for vacation homes', icon: '🌲' },
  { id: 'wine-cellar', label: 'Wine Cellar Sign', description: 'Label your cellar or tasting space', icon: '🍷' },
  { id: 'custom', label: 'Something Custom', description: 'Create a fully custom sign', icon: '✎' }
]

const installationSurfaces = Array.from({ length: 25 }, (_, index) => {
  const surfaceNumber = index + 1
  const fileName = `${surfaceNumber}-skew-fixed.jpg`

  return {
    id: `surface-${String(surfaceNumber).padStart(2, '0')}`,
    label: `Surface ${surfaceNumber}`,
    image: fileName,
    imageUrl: `${installationSurfaceImageBase}${fileName}`
  }
})

const shapes = [
  { id: 'rectangle', label: '10" x 5"', width: 10, height: 5, basePrice: 150 },
  { id: 'oval', label: '13" x 9"', width: 13, height: 9, basePrice: 129 },
  { id: 'round', label: '9" x 13"', width: 9, height: 13, basePrice: 175 },
  { id: 'arch', label: '24" x 12"', width: 24, height: 12, basePrice: 240 }
]

const slateColors = [
  { id: 'black', label: 'Black', hex: '#1a2026', price: 0 },
  { id: 'mottle-black', label: 'Mottle Black', hex: '#2a2d33', price: 15 },
  { id: 'gray', label: 'Gray', hex: '#667179', price: 15 },
  { id: 'green', label: 'Green', hex: '#5f7568', price: 0 },
  { id: 'red', label: 'Red', hex: '#9a5549', price: 20 },
  { id: 'variegated', label: 'Variegated', hex: '#47454f', price: 30 },
  { id: 'burgundy', label: 'Burgundy', hex: '#5f3f4b', price: 25 }
].map((item) => {
  const images = getSlateImageSet(item.id)

  return {
    ...item,
    images,
    imageUrl: images.default
  }
})

const designTemplates = [
  { id: 'tpl-01', label: 'Deluxe #01', tier: 'Deluxe', previewText: '183', accentText: 'EAST STREET', price: 0 },
  { id: 'tpl-02', label: 'Deluxe #02', tier: 'Deluxe', previewText: '27', accentText: 'PINE LANE', price: 0 },
  { id: 'tpl-03', label: 'Regular #03', tier: 'Regular', previewText: '52', accentText: 'HILL ROAD', price: 0 },
  { id: 'tpl-04', label: 'Regular #04', tier: 'Regular', previewText: '860', accentText: 'LAKE DRIVE', price: 0 }
]

const paintColors = [
  { id: 'white', label: 'White', hex: '#f2f4ef', price: 0, image: 'PAINT white.jpg' },
  { id: 'ivory', label: 'Ivory', hex: '#ece6cd', price: 0, image: 'PAINT ivory.jpg' },
  { id: 'copper', label: 'Copper', hex: '#b97145', price: 0, image: 'PAINT Copper.jpg' },
  { id: 'taupe', label: 'Taupe', hex: '#8d8477', price: 0, image: 'PAINT Taupe.jpg' },
  { id: 'brass', label: 'Brass', hex: '#b4a37a', price: 0, image: 'PAINT brass.jpg' },
  { id: 'copper-ivory', label: 'Copper Ivory', hex: '#c49a68', price: 0, image: 'PAINT Copper-Ivory.jpg' },
  { id: 'silver', label: 'White/Silver', hex: '#c9cbcf', price: 0, image: 'PAINT White-Siilver.jpg' }
].map((item) => ({
  ...item,
  imageUrl: `${paintImageBase}${encodeURIComponent(item.image)}`
}))

const addOns = [
  { id: 'none', label: 'No add-ons', price: 0 },
  { id: 'night-vision', label: 'Night Vision ($15)', price: 15 },
  { id: 'reflective', label: 'Reflective Paint ($20)', price: 20 }
]

const mountingHardware = [
  { id: 'none', label: 'No hardware', price: 0 },
  { id: 'rosettes', label: 'Hand Cast Bronze Rosettes (+$25)', price: 25 },
  { id: 'standoffs', label: 'Stainless Standoffs (+$18)', price: 18 }
]

const safeFind = (arr, id) => arr.find((item) => item.id === id) || arr[0]

const frontendConfig = window.SIGN_SELECTOR_CONFIG || {}
const initialConfiguration =
  frontendConfig.initialConfiguration && typeof frontendConfig.initialConfiguration === 'object'
    ? frontendConfig.initialConfiguration
    : {}

const resolveInitialId = (arr, candidate, fallbackId) => {
  if (candidate && arr.some((item) => item.id === candidate)) {
    return candidate
  }

  return fallbackId
}

export const useSignSelectorState = () => {
  const state = reactive({
    currentStep: 1,
    signStyleId: resolveInitialId(signStyles, initialConfiguration?.sign?.style?.id, signStyles[0].id),
    surfaceId: resolveInitialId(installationSurfaces, initialConfiguration?.sign?.surface?.id, installationSurfaces[0].id),
    shapeId: resolveInitialId(shapes, initialConfiguration?.sign?.shape?.id, shapes[1].id),
    slateColorId: resolveInitialId(slateColors, initialConfiguration?.sign?.slateColor?.id, slateColors[3].id),
    templateId: resolveInitialId(designTemplates, initialConfiguration?.sign?.template?.id, designTemplates[0].id),
    paintColorId: resolveInitialId(paintColors, initialConfiguration?.sign?.paintColor?.id, paintColors[4].id),
    addOnId: resolveInitialId(addOns, initialConfiguration?.sign?.addOn?.id, addOns[1].id),
    hardwareId: resolveInitialId(mountingHardware, initialConfiguration?.sign?.hardware?.id, mountingHardware[1].id),
    houseNumber: initialConfiguration?.checkout?.houseNumber || designTemplates[0].previewText,
    bottomText: initialConfiguration?.checkout?.bottomText || '',
    editCartItemKey: frontendConfig.editCartItemKey || initialConfiguration?.checkout?.editCartItemKey || '',
    status: 'idle',
    message: ''
  })

  const selectedSignStyle = computed(() => safeFind(signStyles, state.signStyleId))
  const selectedSurface = computed(() => safeFind(installationSurfaces, state.surfaceId))
  const selectedShape = computed(() => safeFind(shapes, state.shapeId))
  const selectedSlateColor = computed(() => safeFind(slateColors, state.slateColorId))
  const selectedTemplate = computed(() => safeFind(designTemplates, state.templateId))
  const selectedPaintColor = computed(() => safeFind(paintColors, state.paintColorId))
  const selectedAddOn = computed(() => safeFind(addOns, state.addOnId))
  const selectedHardware = computed(() => safeFind(mountingHardware, state.hardwareId))

  const totalPrice = computed(() => {
    return (
      selectedShape.value.basePrice +
      selectedSlateColor.value.price +
      selectedTemplate.value.price +
      selectedPaintColor.value.price +
      selectedAddOn.value.price +
      selectedHardware.value.price
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
      backgroundColor: selectedSlateColor.value.hex,
      backgroundImage: (selectedSlateColor.value.images?.[selectedShape.value.id] || selectedSlateColor.value.imageUrl)
        ? `linear-gradient(0deg, rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.14)), url("${selectedSlateColor.value.images?.[selectedShape.value.id] || selectedSlateColor.value.imageUrl}")`
        : 'none',
      // backgroundSize: 'cover',
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
      template: selectedTemplate.value.price,
      paint: selectedPaintColor.value.price,
      addOn: selectedAddOn.value.price,
      hardware: selectedHardware.value.price,
      total: totalPrice.value
    },
    checkout: {
      step: state.currentStep,
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
    state.currentStep = Math.min(4, Math.max(1, Number(step) || 1))
  }

  const nextStep = () => setStep(state.currentStep + 1)
  const prevStep = () => setStep(state.currentStep - 1)

  const submitConfiguration = async (options = {}) => {
    const config = window.SIGN_SELECTOR_CONFIG || {}
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
    preview,
    payload,
    isFirstStep: computed(() => state.currentStep === 1),
    isLastStep: computed(() => state.currentStep === 4),
    setStep,
    nextStep,
    prevStep,
    submitConfiguration
  }
}