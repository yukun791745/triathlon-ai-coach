import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

interface AICoachCardProps {
  recommendation: string;
  onClick: () => void;
}

export function AICoachCard({ recommendation, onClick }: AICoachCardProps) {
  return (
    <div 
      className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-bold text-sm mb-1">AIコーチからのアドバイス</h3>
          <p className="text-white/90 text-xs leading-relaxed">{recommendation}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
      </div>
    </div>
  );
}
