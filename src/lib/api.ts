/**
 * API統合レイヤー
 * 既存の Netlify Functions と連携
 */

import type {
  ApiResponse,
  ApiError,
  AICoachResponse,
  StravaAuthTokens
} from '../types/api';
import type { Activity, ActivityDetail, ActivityStream } from '../types/activity';
import type { FitnessMetrics, TSSCalculation, TrainingZones } from '../types/metrics';
import type { Race } from '../types/race';
import type { NewsItem } from '../types/news';

// API ベース URL（本番環境では Netlify Functions を使用）
const API_BASE = '/.netlify/functions';

// ヘルパー関数：API呼び出し
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw {
        status: response.status,
        message: response.statusText,
      } as ApiError;
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました',
    };
  }
}

// ====================
// Strava API
// ====================

/**
 * Strava認証URLを取得
 */
export async function getStravaAuthUrl(): Promise<string> {
  // 既存の実装では直接URLを生成
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  const redirectUri = `${window.location.origin}/strava-callback`;
  const scope = 'read,activity:read_all,profile:read_all';
  
  return `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
}

/**
 * Stravaトークンを更新
 */
export async function refreshStravaToken(
  refreshToken: string
): Promise<ApiResponse<StravaAuthTokens>> {
  return fetchAPI('/strava-refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

/**
 * アクティビティ一覧を取得
 */
export async function getActivities(params?: {
  before?: number;
  after?: number;
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<Activity[]>> {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return fetchAPI(`/strava-activities?${query}`);
}

/**
 * アクティビティ詳細を取得
 */
export async function getActivityDetail(
  activityId: number
): Promise<ApiResponse<ActivityDetail>> {
  return fetchAPI(`/strava-activity-detail?id=${activityId}`);
}

/**
 * アクティビティのストリームデータを取得
 */
export async function getActivityStreams(
  activityId: number
): Promise<ApiResponse<ActivityStream>> {
  return fetchAPI(`/strava-streams?id=${activityId}`);
}

/**
 * 複数アクティビティの詳細をバッチ取得
 */
export async function getBatchActivityDetails(
  activityIds: number[]
): Promise<ApiResponse<ActivityDetail[]>> {
  return fetchAPI('/strava-batch-details', {
    method: 'POST',
    body: JSON.stringify({ activityIds }),
  });
}

/**
 * トレーニング負荷を計算
 */
export async function calculateTrainingLoad(params: {
  activityIds?: number[];
  days?: number;
}): Promise<ApiResponse<FitnessMetrics>> {
  return fetchAPI('/strava-training-load', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * TSS（Training Stress Score）を計算
 */
export async function calculateTSS(params: {
  activityId: number;
  ftp?: number;
}): Promise<ApiResponse<TSSCalculation>> {
  return fetchAPI('/strava-tss', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * トレーニングゾーンを取得
 */
export async function getTrainingZones(): Promise<ApiResponse<TrainingZones>> {
  return fetchAPI('/strava-zones');
}

// ====================
// AI コーチ API
// ====================

/**
 * AIコーチのコメントを取得
 */
export async function getAICoachComment(params?: {
  ctl?: number;
  atl?: number;
  tsb?: number;
  recentActivities?: Activity[];
  upcomingRace?: Race;
}): Promise<ApiResponse<AICoachResponse>> {
  return fetchAPI('/ai-coach-comment', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * AIコーチとチャット
 */
export async function chatWithAI(params: {
  message: string;
  context?: {
    ctl?: number;
    atl?: number;
    tsb?: number;
    recentActivities?: Activity[];
  };
  attachments?: File[];
}): Promise<ApiResponse<{ response: string }>> {
  // ファイル添付がある場合は FormData を使用
  if (params.attachments && params.attachments.length > 0) {
    const formData = new FormData();
    formData.append('message', params.message);
    formData.append('context', JSON.stringify(params.context));
    
    params.attachments.forEach((file, index) => {
      formData.append(`file${index}`, file);
    });

    try {
      const response = await fetch(`${API_BASE}/openai`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました',
      };
    }
  }

  // テキストのみの場合
  return fetchAPI('/openai', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ====================
// レース API
// ====================

/**
 * 参加予定レースを取得
 */
export async function getUpcomingRaces(): Promise<ApiResponse<Race[]>> {
  return fetchAPI('/fetch-races');
}

// ====================
// ニュース API
// ====================

/**
 * トライアスロンニュースを取得
 */
export async function getNews(params?: {
  limit?: number;
}): Promise<ApiResponse<NewsItem[]>> {
  const query = params ? `?limit=${params.limit}` : '';
  return fetchAPI(`/news${query}`);
}

// ====================
// モックデータ（開発用）
// ====================

/**
 * モックのフィットネスメトリクスを取得
 */
export function getMockFitnessMetrics(): FitnessMetrics {
  return {
    ctl: 87,
    ctlDelta: 3,
    atl: 62,
    atlDelta: -8,
    tsb: 25,
    tsbDelta: 11,
    date: new Date().toISOString(),
  };
}

/**
 * モックのアクティビティを取得
 */
export function getMockActivities(): Activity[] {
  return [
    {
      id: 1,
      name: '持久力スイムセッション',
      type: 'Swim',
      distance: 3200,
      moving_time: 5040,
      elapsed_time: 5040,
      start_date: new Date().toISOString(),
      start_date_local: new Date().toISOString(),
      average_speed: 0.635,
    },
  ];
}

/**
 * モックのレースを取得
 */
export function getMockRaces(): Race[] {
  return [
    {
      id: 1,
      name: 'オリンピックディスタンス・トライアスロン',
      date: '2026-01-18',
      dateFormatted: '2026年1月18日（日）',
      daysLeft: 8,
      distance: 'Olympic',
      targetTime: '2:30:00',
      predictedTime: '2:28:15',
    },
    {
      id: 2,
      name: 'スプリント・トライアスロン大会',
      date: '2026-02-15',
      dateFormatted: '2026年2月15日（日）',
      daysLeft: 36,
      distance: 'Sprint',
      targetTime: '1:15:00',
      predictedTime: '1:13:42',
    },
  ];
}

/**
 * モックのニュースを取得
 */
export function getMockNews(): NewsItem[] {
  return [
    {
      id: '1',
      title: 'ゾーン2トレーニングの効果を示す新研究',
      source: 'TrainingPeaks',
      link: 'https://www.trainingpeaks.com',
      pubDate: new Date().toISOString(),
    },
    {
      id: '2',
      title: '長距離レースの栄養戦略',
      source: 'Triathlete Magazine',
      link: 'https://www.triathlete.com',
      pubDate: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'プロアスリートのリカバリーテクニック',
      source: 'IRONMAN',
      link: 'https://www.ironman.com',
      pubDate: new Date().toISOString(),
    },
  ];
}
