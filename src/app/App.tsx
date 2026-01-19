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
import { FileAttachment } from './components/ai-coach/FileAttachment';
import type { AttachedFile } from './components/ai-coach/FileAttachment';
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

  // (省略: 残りの実装は既存のまま)
  return null;
}
