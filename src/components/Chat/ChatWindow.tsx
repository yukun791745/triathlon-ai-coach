import React, { useState, useRef, useEffect } from 'react'
import Message from './Message'

type Msg = { id: string; role: 'user' | 'assistant'; text: string }

export default function ChatWindow() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text) return
    const userMsg: Msg = { id: String(Date.now()) + '-u', role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()

      if (!res.ok) {
        const errMsg = data?.error ?? 'サーバエラー'
        setMessages(prev => [...prev, { id: String(Date.now()) + '-e', role: 'assistant', text: `エラー: ${errMsg}` }])
      } else {
        const assistantText =
          data?.text ??
          (Array.isArray(data?.choices) && (data.choices[0]?.message?.content ?? data.choices[0]?.text)) ??
          JSON.stringify(data)
        const aiMsg: Msg = { id: String(Date.now()) + '-a', role: 'assistant', text: String(assistantText) }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: String(Date.now()) + '-e', role: 'assistant', text: 'エラーが発生しました' }])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-md p-4">
      <div ref={scrollRef} className="h-80 overflow-y-auto mb-4 space-y-3">
        {messages.length === 0 && <div className="text-sm text-gray-500">AIコーチを起動してメッセージを送信してください。</div>}
        {messages.map(m => <Message key={m.id} role={m.role} text={m.text} />)}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="質問を入力..."
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
        />
        <button
          className="bg-indigo-600 text-white px-4 rounded disabled:opacity-50"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? '送信中...' : '送信'}
        </button>
      </div>
    </div>
  )
}
