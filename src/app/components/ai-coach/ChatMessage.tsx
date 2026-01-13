import { Sparkles } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  if (role === 'assistant') {
    return (
      <div className="flex gap-2.5 items-start">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {/* Message Bubble */}
        <div className="flex-1 max-w-[85%]">
          <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 border border-indigo-100/60 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm">
            <p className="text-slate-700 text-sm leading-loose">{content}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 ml-1">{timestamp}</p>
        </div>
      </div>
    );
  }

  // User message
  return (
    <div className="flex gap-2.5 items-start justify-end">
      <div className="flex-1 max-w-[85%] flex flex-col items-end">
        <div className="bg-gradient-to-br from-rose-400 to-purple-400 rounded-2xl rounded-tr-sm px-4 py-3.5 shadow-sm">
          <p className="text-white text-sm leading-loose">{content}</p>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 mr-1">{timestamp}</p>
      </div>
    </div>
  );
}
