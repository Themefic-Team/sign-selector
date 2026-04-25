// Shim so that `import $ from 'jquery'` (used internally by select2)
// resolves to the global jQuery already loaded by WordPress.
export default window.jQuery
