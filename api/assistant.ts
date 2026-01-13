// Simple Vercel serverless function to proxy requests to OpenAI.
// IMPORTANT: Set OPENAI_API_KEY in your deployment environment variables.
// Do NOT commit any secret keys.

import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { message } = req.body || {}
  if (!message) {
    res.status(400).json({ error: 'Missing `message` in request body' })
    return
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) {
    res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY not set' })
    return
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: message }],
        max_tokens: 800,
      }),
    })

    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    console.error('assistant proxy error', err)
    res.status(500).json({ error: 'Proxy failed' })
  }
}
