/**
 * v-select2 directive
 *
 * select2 JS is loaded as a WordPress script dependency (assets/select2.min.js)
 * so it is always registered against window.jQuery before this module runs.
 * We only import the CSS here so Vite can bundle it into the stylesheet.
 */

import 'select2/dist/css/select2.min.css'

function getJq() {
  return window.jQuery
}

const DEFAULT_OPTS = {
  width: '100%',
  dropdownAutoWidth: false,
}

// Read the current selected values straight from the native <select> DOM state.
function getDomValue(el) {
  if (el.multiple) {
    return Array.from(el.options).filter(o => o.selected).map(o => o.value)
  }
  return el.value
}

// A per-element flag to break the Vue ↔ Select2 event loop.
// When we push a value into Select2 (.trigger('change')), jQuery dispatches
// a native DOM change event which Vue's v-model would pick up and re-trigger
// the `updated` hook → infinite recursion. The flag makes the change.vselect2
// handler a no-op during programmatic syncs.
const SYNC_FLAG = 'data-s2-syncing'

function initSelect2(el, binding) {
  const $ = getJq()
  if (!$) return

  // Tear down any previous instance
  if ($(el).data('select2')) {
    $(el).off('change.vselect2')
    $(el).select2('destroy')
  }

  // Build options — strip `multiple` since Select2 auto-detects from the HTML attribute
  const userOpts = typeof binding.value === 'object' && binding.value !== null ? binding.value : {}
  const { multiple: _ignored, ...restOpts } = userOpts
  const opts = { ...DEFAULT_OPTS, ...restOpts, theme: restOpts.theme || 'sign-selector' }

  $(el).select2(opts)

  // Push the current DOM value into Select2's UI (guarded against loop)
  el.setAttribute(SYNC_FLAG, '1')
  $(el).val(getDomValue(el)).trigger('change')
  el.removeAttribute(SYNC_FLAG)

  // Sync Select2 → Vue when the user picks something
  $(el).on('change.vselect2', function () {
    if (el.hasAttribute(SYNC_FLAG)) return
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function destroySelect2(el) {
  const $ = getJq()
  if (!$) return
  try {
    $(el).off('change.vselect2')
    if ($(el).data('select2')) {
      $(el).select2('destroy')
    }
  } catch (_) {}
}

// Push Vue's current DOM state into Select2's display widget.
function syncToSelect2(el) {
  const $ = getJq()
  if (!$ || !$(el).data('select2')) return
  try {
    el.setAttribute(SYNC_FLAG, '1')
    $(el).val(getDomValue(el)).trigger('change')
    el.removeAttribute(SYNC_FLAG)
  } catch (_) {
    el.removeAttribute(SYNC_FLAG)
  }
}

export const vSelect2 = {
  mounted(el, binding) {
    // Defer so Vue has finished rendering the <option> children first
    setTimeout(() => initSelect2(el, binding), 0)
  },
  updated(el, binding) {
    setTimeout(() => {
      const $ = getJq()
      if (!$) return
      if (!$(el).data('select2')) {
        initSelect2(el, binding)
      } else {
        syncToSelect2(el)
      }
    }, 0)
  },
  beforeUnmount(el) {
    destroySelect2(el)
  },
}

