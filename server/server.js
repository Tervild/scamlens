require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Groq = require('groq-sdk')

const app = express()

app.use(cors())
app.use(express.json())

const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
})

function calculateScore(text) {
	let score = 0
	const lower = text.toLowerCase()

	if (lower.includes('verify')) score += 15
	if (lower.includes('urgent')) score += 20
	if (lower.includes('immediately')) score += 20
	if (lower.includes('suspended')) score += 15
	if (lower.includes('disabled')) score += 15
	if (lower.includes('click')) score += 10
	if (lower.includes('final notice')) score += 20
	if (lower.includes('10 minutes')) score += 20

	return Math.min(score, 100)
}

app.post('/analyze', async (req, res) => {
	try {
		const prompt = `
Analyze webpage text for scam indicators.

Return ONLY JSON:

{
  "reason": "short explanation",
  "actions": ["action1", "action2"]
}

Text:
${req.body.text.slice(0, 1000)}
`

		const completion = await groq.chat.completions.create({
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
			model: 'llama-3.3-70b-versatile',
		})

		const response = completion.choices[0].message.content

		const cleaned = response
			.replace(/```json/g, '')
			.replace(/```/g, '')
			.trim()

		const parsed = JSON.parse(cleaned)

		const score = calculateScore(req.body.text)

		let risk = 'LOW'

		if (score >= 85) risk = 'CRITICAL'
		else if (score >= 60) risk = 'HIGH'
		else if (score >= 35) risk = 'MEDIUM'

		res.send({
			risk,
			score,
			reason: parsed.reason,
			actions: parsed.actions,
		})
	} catch (err) {
		console.error(err)

		res.send({
			risk: 'UNKNOWN',
			score: 0,
			reason: 'Analysis failed',
			actions: [],
		})
	}
})

app.post('/analyze-qr', async (req, res) => {
console.log('QR endpoint called:', req.body.url)

	const url = req.body.url

	let score = 10
	let risk = 'LOW'
	const reasons = []

	if (!url.startsWith('https://')) {
		score += 25
		reasons.push('The link does not use HTTPS.')
	}

	if (
		url.includes('bit.ly') ||
		url.includes('tinyurl') ||
		url.includes('t.co')
	) {
		score += 30
		reasons.push('The QR code uses a shortened link.')
	}

	if (
		url.includes('login') ||
		url.includes('verify') ||
		url.includes('account')
	) {
		score += 30
		reasons.push('The link contains suspicious authentication words.')
	}

	if (score >= 75) risk = 'HIGH'
	else if (score >= 40) risk = 'MEDIUM'

	res.send({
		risk,
		score,
		url,
		reason:
			reasons.length > 0
				? reasons.join(' ')
				: 'This QR link does not show obvious phishing indicators.',
	})
})

app.listen(3000, () => {
	console.log('ScamLens server running')
})


