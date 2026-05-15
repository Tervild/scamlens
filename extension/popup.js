const input = document.getElementById('siteInput')
const addBtn = document.getElementById('addSite')
const list = document.getElementById('siteList')
const errorBox = document.getElementById('error')

function normalizeSite(site) {
	return site
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/^www\./, '')
		.split('/')[0]
}

function isValidDomain(site) {
	const domainRegex = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

	return domainRegex.test(site)
}

function loadSites() {
	chrome.storage.sync.get(['ignoredSites'], result => {
		const sites = result.ignoredSites || []
		list.innerHTML = ''

		if (sites.length === 0) {
			list.innerHTML = `<div class="empty">No ignored websites yet.</div>`
			return
		}

		sites.forEach(site => {
			const li = document.createElement('li')
			li.innerHTML = `
				<span>${site}</span>
				<span class="remove" data-site="${site}">✖</span>
			`
			list.appendChild(li)
		})

		document.querySelectorAll('.remove').forEach(btn => {
			btn.addEventListener('click', () => removeSite(btn.dataset.site))
		})
	})
}

function addSite() {
	errorBox.textContent = ''

	const site = normalizeSite(input.value)

	if (!site) {
		errorBox.textContent = 'Enter a website domain.'
		return
	}

	if (!isValidDomain(site)) {
		errorBox.textContent = 'Invalid website. Example: example.com'
		return
	}

	chrome.storage.sync.get(['ignoredSites'], result => {
		const sites = result.ignoredSites || []

		if (sites.includes(site)) {
			errorBox.textContent = 'This website is already ignored.'
			return
		}

		sites.push(site)

		chrome.storage.sync.set({ ignoredSites: sites }, () => {
			input.value = ''
			loadSites()
		})
	})
}

function removeSite(site) {
	chrome.storage.sync.get(['ignoredSites'], result => {
		const sites = result.ignoredSites || []
		const updated = sites.filter(s => s !== site)

		chrome.storage.sync.set({ ignoredSites: updated }, loadSites)
	})
}

addBtn.addEventListener('click', addSite)

input.addEventListener('keydown', event => {
	if (event.key === 'Enter') addSite()
})

loadSites()

const scanQrBtn = document.getElementById('scanQr')

console.log('QR button:', scanQrBtn)

scanQrBtn.addEventListener('click', async () => {
	console.log('QR button clicked')

	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	})

	console.log('Current tab:', tab)

	chrome.tabs.sendMessage(tab.id, { action: 'SCAN_QR_CODES' }, response => {
		if (chrome.runtime.lastError) {
			console.error('Message error:', chrome.runtime.lastError.message)
			return
		}

		console.log('Content response:', response)
	})
})