import { computed, reactive, watch } from 'vue'

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

const installationSurfaces = [
  {
    id: 'red-brick',
    label: 'Red Brick',
    css: 'linear-gradient(0deg, rgba(0,0,0,.08), rgba(0,0,0,.08)), repeating-linear-gradient(90deg, #b54a35, #b54a35 68px, #d5c0af 68px, #d5c0af 72px), repeating-linear-gradient(0deg, #c95642, #c95642 26px, #d5c0af 26px, #d5c0af 30px)'
  },
  {
    id: 'gray-brick',
    label: 'Gray Brick',
    css: 'linear-gradient(0deg, rgba(0,0,0,.08), rgba(0,0,0,.08)), repeating-linear-gradient(90deg, #888988, #888988 68px, #d4d2cf 68px, #d4d2cf 72px), repeating-linear-gradient(0deg, #a3a29f, #a3a29f 26px, #d4d2cf 26px, #d4d2cf 30px)'
  },
  {
    id: 'beige-stone',
    label: 'Beige Stone',
    css: 'linear-gradient(130deg, #d9c9a8, #e8dcc3 45%, #cab48d 80%)'
  },
  {
    id: 'wood',
    label: 'Wood',
    css: 'repeating-linear-gradient(90deg, #865a3e 0, #865a3e 14px, #926448 14px, #926448 28px)'
  }
]

const shapes = [
  { id: 'rectangle', label: '10" x 5"', width: 10, height: 5, basePrice: 150 },
  { id: 'oval', label: '13" x 9"', width: 13, height: 9, basePrice: 129 },
  { id: 'round', label: '15" x 15"', width: 15, height: 15, basePrice: 175 },
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
]

const designTemplates = [
  { id: 'tpl-01', label: 'Deluxe #01', tier: 'Deluxe', previewText: '183', accentText: 'EAST STREET', price: 0 },
  { id: 'tpl-02', label: 'Deluxe #02', tier: 'Deluxe', previewText: '27', accentText: 'PINE LANE', price: 0 },
  { id: 'tpl-03', label: 'Standard #03', tier: 'Standard', previewText: '52', accentText: 'HILL ROAD', price: 0 },
  { id: 'tpl-04', label: 'Standard #04', tier: 'Standard', previewText: '860', accentText: 'LAKE DRIVE', price: 0 }
]

const paintColors = [
  { id: 'white', label: 'White', hex: '#f2f4ef', price: 0 },
  { id: 'ivory', label: 'Ivory', hex: '#ece6cd', price: 0 },
  { id: 'copper', label: 'Copper', hex: '#b97145', price: 0 },
  { id: 'taupe', label: 'Taupe', hex: '#8d8477', price: 0 },
  { id: 'brass', label: 'Brass', hex: '#b4a37a', price: 0 },
  { id: 'silver', label: 'White/Silver', hex: '#c9cbcf', price: 0 }
]

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

export const useSignSelectorState = () => {
  const state = reactive({
    currentStep: 1,
    signStyleId: signStyles[0].id,
    surfaceId: installationSurfaces[0].id,
    shapeId: shapes[1].id,
    slateColorId: slateColors[3].id,
    templateId: designTemplates[0].id,
    paintColorId: paintColors[4].id,
    addOnId: addOns[1].id,
    hardwareId: mountingHardware[1].id,
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
      background: selectedSurface.value.css
    },
    signStyle: {
      background: selectedSlateColor.value.hex,
      color: selectedPaintColor.value.hex,
      boxShadow: '0 14px 28px rgba(0,0,0,0.25)'
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

  const submitConfiguration = async () => {
    const config = window.SIGN_SELECTOR_CONFIG || {}
    if (!config.ajaxUrl || !config.action) {
      state.status = 'error'
      state.message = 'Backend endpoint is not configured.'
      return
    }

    state.status = 'submitting'
    state.message = ''

    const formData = new FormData()
    formData.append('action', config.action)
    formData.append('nonce', config.nonce || '')
    formData.append('configuration', JSON.stringify(payload.value))

    try {
      const response = await fetch(config.ajaxUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result?.data?.message || 'Could not save configuration')
      }

      state.status = 'success'
      state.message = 'Configuration sent successfully.'
    } catch (error) {
      state.status = 'error'
      state.message = error instanceof Error ? error.message : 'Request failed.'
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