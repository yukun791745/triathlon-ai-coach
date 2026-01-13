export default function Message({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user'
  return (
    <div className={`max-w-[85%] ${isUser ? 'ml-auto bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'} p-2 rounded-md`}>
      <div className="text-sm whitespace-pre-wrap">{text}</div>
    </div>
  )
}
