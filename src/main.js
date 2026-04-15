import { createApp } from 'vue'
import App from './App.vue'

const MOUNT_SELECTOR = '.sign-selector-app'
const MOUNT_FLAG = 'signSelectorMounted'

const mountSignSelector = (root) => {
	if (!root || root.dataset[MOUNT_FLAG] === '1') {
		return
	}

	const signSelectorConfig = window.SIGN_SELECTOR_CONFIG || {}
	const pluginDirectoryUrl = signSelectorConfig.plugin_directory_url || ''

	root.dataset[MOUNT_FLAG] = '1'
	window.SIGN_SELECTOR_PLUGIN_URL = pluginDirectoryUrl

	const app = createApp(App)
	app.config.globalProperties.$signSelectorConfig = signSelectorConfig
	app.config.globalProperties.$pluginDirectoryUrl = pluginDirectoryUrl
	app.provide('signSelectorConfig', signSelectorConfig)
	app.provide('pluginDirectoryUrl', pluginDirectoryUrl)
	app.mount(root)
}

const mountAll = () => {
	document.querySelectorAll(MOUNT_SELECTOR).forEach(mountSignSelector)
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', mountAll)
} else {
	mountAll()
}

const observer = new MutationObserver((mutations) => {
	mutations.forEach((mutation) => {
		mutation.addedNodes.forEach((node) => {
			if (!(node instanceof Element)) {
				return
			}

			if (node.matches(MOUNT_SELECTOR)) {
				mountSignSelector(node)
			}

			node.querySelectorAll?.(MOUNT_SELECTOR).forEach(mountSignSelector)
		})
	})
})

observer.observe(document.documentElement, { childList: true, subtree: true })
