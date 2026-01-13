import React from 'react';
import { Home, Dumbbell, Trophy, BotMessageSquare, Newspaper, Settings } from 'lucide-react';
import { Header } from './components/navigation/Header';
import { BottomNav } from './components/navigation/BottomNav';
import { AICoachCard } from './components/dashboard/AICoachCard';
import { FitnessMetricsCard } from './components/dashboard/FitnessMetricsCard';
import { RecentActivityCard } from './components/dashboard/RecentActivityCard';
import { UpcomingRacesCard } from './components/dashboard/UpcomingRacesCard';
import { NewsCard } from './components/dashboard/NewsCard';
import { ChatMessage } from './components/ai-coach/ChatMessage';
import { ChatInput } from './components/ai-coach/ChatInput';
import { FileAttachment, AttachedFile } from './components/ai-coach/FileAttachment';
import { useActivities } from '../hooks/useActivities';
import { useFitnessMetrics } from '../hooks/useFitnessMetrics';
import { useRaces } from '../hooks/useRaces';
import { useNews } from '../hooks/useNews';
import { useAIChat } from '../hooks/useAIChat';

export default function App() {
  // Navigation state
  const [activeTab, setActiveTab] = React.useState('home');

  // Chat input state for AI Coach
  const [chatInput, setChatInput] = React.useState('');
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  // Fetch data using custom hooks (using mock data for now)
  const { activities, loading: activitiesLoading } = useActivities({ useMock: true });
  const { metrics, loading: metricsLoading } = useFitnessMetrics({ useMock: true });
  const { races, loading: racesLoading } = useRaces({ useMock: true });
  const { news, loading: newsLoading } = useNews({ useMock: true });
  const { messages, sendMessage, loading: aiLoading } = useAIChat();

  // Date formatter
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  // Handle file selection for AI chat
  const handleFileSelect = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);

    const newFiles: AttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = getFileType(file);

      const attachedFile: AttachedFile = {
        id: `${Date.now()}-${i}`,
        file,
        type: fileType,
        size: file.size,
        name: file.name,
      };

      // Generate preview for images
      if (fileType === 'image') {
        attachedFile.preview = await generateImagePreview(file);
      }

      newFiles.push(attachedFile);
    }

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    setIsUploading(false);
  };

  // Get file type from file
  const getFileType = (file: File): AttachedFile['type'] => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'csv') return 'csv';
    if (ext === 'txt') return 'txt';
    return 'other';
  };

  // Generate image preview
  const generateImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  };

  // Remove attached file
  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Handle send message in AI Chat
  const handleSendMessage = async () => {
    if (!chatInput.trim() && attachedFiles.length === 0) return;

    // Convert attached files to File array
    const files = attachedFiles.map((f) => f.file);

    // Send message with context
    await sendMessage(chatInput, files, {
      ctl: metrics?.ctl,
      atl: metrics?.atl,
      tsb: metrics?.tsb,
    });

    // Reset
    setChatInput('');
    setAttachedFiles([]);
  };

  // Navigation tabs configuration
  const navTabs = [
    { id: 'home', label: 'ホーム', icon: Home },
    { id: 'training', label: 'トレーニング', icon: Dumbbell },
    { id: 'race', label: 'レース', icon: Trophy },
    { id: 'ai-coach', label: 'AIコーチ', icon: BotMessageSquare },
    { id: 'news', label: 'ニュース', icon: Newspaper },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  // AI recommendation based on TSB
  const getAIRecommendation = () => {
    if (!metrics) return 'データを読み込んでいます...';
    
    const { tsb } = metrics;
    if (tsb > 10) {
      return '今日はコンディション良好。高強度トレーニングに最適です。レース前の勢いを維持するため、テンポランを推奨します。';
    } else if (tsb > -10) {
      return 'バランスの取れた状態です。中強度のトレーニングで調整しましょう。';
    } else {
      return '疲労が蓄積しています。今日は軽めのリカバリーセッションまたは完全休養を推奨します。';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Mobile Container */}
      <div className="max-w-md mx-auto bg-white min-h-screen relative">
        {/* Conditional Header Based on Active Tab */}
        {activeTab === 'ai-coach' ? (
          <Header
            date={today}
            title="AIコーチ"
            subtitle={
              metrics
                ? `今日のコンディション：TSB ${metrics.tsb.toFixed(0)} / CTL ${metrics.ctl.toFixed(0)} / ATL ${metrics.atl.toFixed(0)}`
                : 'データを読み込んでいます...'
            }
          />
        ) : activeTab === 'news' ? null : (
          <Header date={today} />
        )}

        {/* Main Content Based on Active Tab */}
        {activeTab === 'ai-coach' ? (
          // AI Coach Chat Screen
          <main className="flex flex-col h-[calc(100vh-8rem)] pb-2">
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={new Date(msg.timestamp).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              ))}
              {aiLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span>考えています...</span>
                </div>
              )}
            </div>

            {/* Attached Files Preview */}
            <FileAttachment files={attachedFiles} onRemove={removeAttachedFile} />

            {/* Input Bar */}
            <ChatInput
              value={chatInput}
              onChange={setChatInput}
              onSend={handleSendMessage}
              attachedFiles={attachedFiles}
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              disabled={aiLoading}
            />
          </main>
        ) : activeTab === 'news' ? (
          // News Screen (placeholder for now)
          <main className="p-4 pb-20">
            <h1 className="text-2xl font-bold text-[#2d3561] mb-4">トライアスロンニュース</h1>
            {newsLoading ? (
              <p className="text-gray-500">読み込み中...</p>
            ) : (
              <div className="space-y-3">
                {news.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                    <p className="text-xs text-gray-500">{item.source}</p>
                  </a>
                ))}
              </div>
            )}
          </main>
        ) : activeTab === 'training' ? (
          // Training Screen (placeholder for now)
          <main className="p-4 pb-20">
            <h1 className="text-2xl font-bold text-[#2d3561] mb-4">トレーニング</h1>
            <p className="text-gray-600">トレーニング画面は開発中です。</p>
          </main>
        ) : activeTab === 'race' ? (
          // Race Screen (placeholder for now)
          <main className="p-4 pb-20">
            <h1 className="text-2xl font-bold text-[#2d3561] mb-4">レース</h1>
            <p className="text-gray-600">レース画面は開発中です。</p>
          </main>
        ) : activeTab === 'settings' ? (
          // Settings Screen (placeholder for now)
          <main className="p-4 pb-20">
            <h1 className="text-2xl font-bold text-[#2d3561] mb-4">設定</h1>
            <p className="text-gray-600">設定画面は開発中です。</p>
          </main>
        ) : (
          // Dashboard Content (Home)
          <main className="space-y-3 pb-20 px-4 pt-3">
            <AICoachCard
              recommendation={getAIRecommendation()}
              onClick={() => setActiveTab('ai-coach')}
            />

            {metrics && <FitnessMetricsCard metrics={metrics} />}

            <RecentActivityCard
              activities={activities}
              onViewAll={() => setActiveTab('training')}
            />

            <UpcomingRacesCard races={races} onViewAll={() => setActiveTab('race')} />

            <NewsCard news={news} onViewAll={() => setActiveTab('news')} />
          </main>
        )}

        {/* Fixed Bottom Navigation Bar */}
        <BottomNav tabs={navTabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}
