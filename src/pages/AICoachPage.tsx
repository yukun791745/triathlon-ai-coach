import ChatWindow from '../components/Chat/ChatWindow'

export default function AICoachPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">🤖 AI トライアスロンコーチ (PoC)</h1>
        <ChatWindow />
      </div>
    </div>
  )
}
