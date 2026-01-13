// api/assistant.ts
// Vercel serverless function (using `any` for req/res to avoid type issues).
// IMPORTANT: Set OPENAI_API_KEY in Vercel environment variables.

function truncateToMaxJapaneseChars(text: string, max = 500) {
  text = text.trim()
  if (text.length <= max) return text
  let truncated = text.slice(0, max)
  const cutAt = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('\n')
  )
  if (cutAt > Math.floor(max * 0.4)) {
    truncated = truncated.slice(0, cutAt + 1)
  }
  truncated = truncated.replace(/[。！？、\s]+$/u, '')
  if (!/[。！？]$/.test(truncated)) truncated = truncated + '…'
  return truncated
}

function needsExpansion(text: string, min = 300) {
  if (!text) return true
  return text.trim().length < min
}

async function callOpenAI(messageSequence: any[], apiKey: string) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // 必要に応じて変更してください
      messages: messageSequence,
      max_tokens: 600,
      temperature: 0.7,
    }),
  })
  const data = await resp.json()
  return { ok: resp.ok, status: resp.status, data }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid `message` in request body' })
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY not set' })
  }

  const systemMsg = {
    role: 'system',
    content:
      'あなたは日本語で回答するアシスタントです。ユーザーの問いに対して必ず日本語で回答してください。' +
      '回答の長さはできるだけ 300～500 文字の範囲に収めてください（日本語の文字数で判定）。' +
      '必要なら要点に絞って調整し、長すぎる場合は短くまとめてください。',
  }

  try {
    const seq = [systemMsg, { role: 'user', content: String(message) }]
    const first = await callOpenAI(seq, OPENAI_KEY)

    if (!first.ok) {
      const errMsg = first.data?.error?.message ?? 'OpenAI request failed'
      console.error('OpenAI error:', first.status, first.data)
      return res.status(first.status).json({ error: String(errMsg) })
    }

    let assistantText: string | undefined
    if (Array.isArray(first.data?.choices) && first.data.choices.length > 0) {
      const ch0 = first.data.choices[0]
      assistantText = ch0?.message?.content ?? ch0?.text ?? undefined
    }
    if (!assistantText) assistantText = first.data?.text ?? first.data?.result ?? JSON.stringify(first.data)

    const trimmed = assistantText.trim()
    if (trimmed.length > 500) {
      const t = truncateToMaxJapaneseChars(trimmed, 500)
      return res.status(200).json({ text: t })
    }

    if (needsExpansion(trimmed, 300)) {
      // 再生成：1回のみ
      const expandSystem = {
        role: 'system',
        content:
          '先ほどの回答をより詳しく、しかし簡潔にして、日本語で 300～500 文字の範囲になるように再作成してください。' +
          '重要なポイントは残しつつ、字数が不足している部分を自然な流れで補ってください。（この操作は1回のみ行います）',
      }
      const prevUser = { role: 'user', content: `前の回答:\n${assistantText}\n\nこの回答を300〜500文字で詳述してください。` }
      const secondSeq = [expandSystem, prevUser]
      const second = await callOpenAI(secondSeq, OPENAI_KEY)
      if (!second.ok) {
        const errMsg = second.data?.error?.message ?? 'OpenAI re-generation failed'
        console.error('OpenAI re-gen error:', second.status, second.data)
        return res.status(second.status).json({ error: String(errMsg) })
      }

      let expandedText: string | undefined
      if (Array.isArray(second.data?.choices) && second.data.choices.length > 0) {
        const ch0 = second.data.choices[0]
        expandedText = ch0?.message?.content ?? ch0?.text ?? undefined
      }
      if (!expandedText) expandedText = second.data?.text ?? second.data?.result ?? JSON.stringify(second.data)

      const final = expandedText.trim()
      if (final.length > 500) {
        return res.status(200).json({ text: truncateToMaxJapaneseChars(final, 500) })
      } else {
        return res.status(200).json({ text: final })
      }
    }

    return res.status(200).json({ text: trimmed })
  } catch (err) {
    console.error('assistant proxy unexpected error:', err)
    return res.status(500).json({ error: 'Proxy failed' })
  }
}
