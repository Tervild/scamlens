console.log('jsQR available:', typeof jsQR)

const API_URL = 'https://duplex-take-raft.ngrok-free.dev'

window.addEventListener('load', () => {
	const currentHost = window.location.hostname.replace('www.', '')

	chrome.storage.sync.get(['ignoredSites'], result => {
		const ignoredSites = result.ignoredSites || []

		const isIgnored = ignoredSites.some(site => {
			return currentHost === site || currentHost.endsWith('.' + site)
		})

		if (isIgnored) {
			console.log('ScamLens skipped:', currentHost)
			return
		}

		analyzePage()
	})
})

function analyzePage() {
	setTimeout(() => {
		const pageText = document.body.innerText.trim().slice(0, 1000)

		console.log('ScamLens text length:', pageText.length)

		if (pageText.length < 30) {
			showWarning({
				risk: 'LOW',
				score: 0,
				reason: 'Not enough readable text found on this page.',
				actions: [],
			})
			return
		}

		fetch(`${API_URL}/analyze`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'ngrok-skip-browser-warning': 'true',
			},
			body: JSON.stringify({ text: pageText }),
		})
			.then(res => res.json())
			.then(showWarning)
			.catch(err => console.error('Fetch error:', err))
	}, 3000)
}

function showWarning(data) {
	const oldBox = document.querySelector('.scamlens-warning')
	if (oldBox) oldBox.remove()

	const box = document.createElement('div')
	box.className = 'scamlens-warning'

	const score = Math.max(0, Math.min(100, Number(data.score) || 0))

	const riskColors = {
		LOW: 'linear-gradient(135deg, #16a34a, #064e3b)',
		MEDIUM: 'linear-gradient(135deg, #ca8a04, #713f12)',
		HIGH: 'linear-gradient(135deg, #dc2626, #450a0a)',
		CRITICAL: 'linear-gradient(135deg, #111827, #000000)',
		UNKNOWN: 'linear-gradient(135deg, #475569, #0f172a)',
	}

	box.style.background =
		riskColors[String(data.risk).toUpperCase()] ||
		'linear-gradient(135deg, #475569, #0f172a)'

	box.innerHTML = `
		<button class="scamlens-close">✖</button>

		<h2>⚠ ${data.risk}</h2>

		<p>Scam Probability: ${score}%</p>

		<p>${data.reason}</p>

		${
			data.actions && data.actions.length > 0
				? `
					<h4>Recommended Actions:</h4>
					<ul>
						${data.actions.map(a => `<li>${a}</li>`).join('')}
					</ul>
				  `
				: ''
		}
	`

	document.body.appendChild(box)

	box.querySelector('.scamlens-close').addEventListener('click', () => {
		box.remove()
	})
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log('Message received in content.js:', message)

	if (message.action === 'SCAN_QR_CODES') {
		
		scanQRCodes()
		sendResponse({ status: 'QR scan started' })
	}

	return true
})

async function scanQRCodes() {
	console.log('QR scan function started')
	console.log('Images found:', document.images.length)

	const images = Array.from(document.images)

	for (const img of images) {
		console.log('Checking image:', img.src)

		try {
			const qrText = await readQRFromImage(img)

			console.log('QR result:', qrText)

			if (qrText && qrText.trim().length > 0) {
				await analyzeQRLink(qrText)
				return
			}
		} catch (err) {
			console.log('QR scan skipped:', err.message)
		}
	}

	showQRResult({
		risk: 'LOW',
		score: 0,
		url: '',
		reason: 'No QR codes found on this page.',
	})
}

function readQRFromImage(img) {
	return new Promise(resolve => {
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')

		const image = new Image()

		image.crossOrigin = 'Anonymous'

		image.onload = () => {
			try {
				canvas.width = image.naturalWidth
				canvas.height = image.naturalHeight

				ctx.drawImage(image, 0, 0)

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

				const qr = jsQR(imageData.data, imageData.width, imageData.height)

				resolve(qr ? qr.data : null)
			} catch (err) {
				console.log(err)
				resolve(null)
			}
		}

		image.onerror = () => resolve(null)

		image.src = img.src
	})
}

async function analyzeQRLink(qrText) {
	const isUrl = /^https?:\/\//i.test(qrText)

	if (!isUrl) {
		showQRResult({
			risk: 'INFO',
			score: 0,
			url: '',
			qrData: qrText,
			reason: 'QR code detected. This QR does not contain a website link.',
		})
		return
	}

	const response = await fetch(`${API_URL}/analyze-qr`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'ngrok-skip-browser-warning': 'true',
		},
		body: JSON.stringify({ url: qrText }),
	})

	const data = await response.json()
	showQRResult(data)
}

function showQRResult(data) {
	const old = document.querySelector('.scamlens-qr')
	if (old) old.remove()

	const box = document.createElement('div')
	box.className = 'scamlens-qr'

	box.innerHTML = `
		<button class="scamlens-close">✖</button>
		<h2>▣ QR Scan Result</h2>
		<p><strong>Risk:</strong> ${data.risk}</p>
		<p><strong>Score:</strong> ${data.score}%</p>
		<p>${data.reason}</p>
        ${
					data.qrData
						? `
			<div class="scamlens-qr-data">
				<strong>QR Content:</strong>
				<pre>${data.qrData}</pre>
			</div>
		  `
						: ''
				}
		${
			data.url && /^https?:\/\//i.test(data.url)
				? `
					<div class="scamlens-qr-actions">
						<button id="openQrLink">Open link</button>
						<button id="stayHere">Stay here</button>
					</div>
				  `
				: ''
		}
	`

	document.body.appendChild(box)

	box.querySelector('.scamlens-close').addEventListener('click', () => {
		box.remove()
	})

	const openBtn = box.querySelector('#openQrLink')
	if (openBtn) {
		openBtn.addEventListener('click', () => {
			window.open(data.url, '_blank')
		})
	}

	const stayBtn = box.querySelector('#stayHere')
	if (stayBtn) {
		stayBtn.addEventListener('click', () => {
			box.remove()
		})
	}
}
