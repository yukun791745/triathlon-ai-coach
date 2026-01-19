import React from 'react';

export function useAIChat() {
  const [messages, setMessages] = React.useState<
    { id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }[]
  >([]);
  const loading = false;

  const sendMessage = async (text: string, files: File[] = [], context?: any) => {
    // 最小の送信スタブ：実際は API 呼び出しなどを実装
    const msg = { id: String(Date.now()), role: 'user' as const, content: text, timestamp: Date.now() };
    setMessages((s) => [...s, msg]);
    // ここで AI レスポンスを追加するなど拡張してください
  };

  return { messages, sendMessage, loading };
}
