/**
 * API 共通型定義
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface StravaAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

export interface AICoachResponse {
  comment: string;
  timestamp: string;
  context?: {
    ctl?: number;
    atl?: number;
    tsb?: number;
    recentActivities?: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'pdf' | 'csv' | 'txt' | 'other';
  name: string;
  size: number;
  url?: string;
}
