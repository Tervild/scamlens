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
