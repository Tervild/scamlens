const API_URL = 'https://duplex-take-raft.ngrok-free.dev'

const ignored = ['google.', 'youtube.', 'mail.google.', 'localhost']

if (!ignored.some(site => window.location.hostname.includes(site))) {
	window.addEventListener('load', () => {
		analyzePage()
	})
}

function analyzePage() {
	setTimeout(() => {
		const pageText = document.body.innerText.trim().slice(0, 1000)

		console.log('ScamLens text length:', pageText.length)
		console.log('ScamLens text:', pageText)

		if (pageText.length < 30) {
			showWarning({
				risk: 'LOW',
				score: 0,
				reason: 'Not enough readable text found on this page.',
				actions: ['Try again after the page fully loads.'],
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
	const box = document.createElement('div')
	box.className = 'scamlens-warning'

	const score = Math.max(0, Math.min(100, data.score))

	// Від зеленого (120) до чорного
	const lightness = 50 - score * 0.5

	box.style.background = `hsl(120, 80%, ${lightness}%)`

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
