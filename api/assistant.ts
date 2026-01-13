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

    // Handle error responses from OpenAI
    if (!r.ok) {
      const errorMsg = data?.error?.message || data?.error || 'OpenAI API error'
      res.status(r.status).json({ error: String(errorMsg) })
      return
    }

    // Extract text from OpenAI response structure
    // Try different possible response structures in order of priority
    let text: string | undefined
    const firstChoice = data?.choices?.[0]

    // Standard chat/completions response: choices[0].message.content
    if (firstChoice?.message?.content) {
      text = firstChoice.message.content
    }
    // Fallback: choices[0].text (for completions endpoint)
    else if (firstChoice?.text) {
      text = firstChoice.text
    }
    // Fallback: top-level text or result
    else if (data?.text) {
      text = data.text
    } else if (data?.result) {
      text = data.result
    }

    // If no text could be extracted, stringify the response as fallback
    if (!text) {
      text = JSON.stringify(data)
    }

    // Always return normalized { text: string } response
    res.status(200).json({ text: String(text) })
  } catch (err) {
    console.error('assistant proxy error', err)
    res.status(500).json({ error: 'Proxy failed' })
  }
}
