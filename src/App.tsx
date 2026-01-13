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
    // (残りの実装...)
    return 'other';
  };

  // (残りの App コンポーネント...)
  return null;
}
