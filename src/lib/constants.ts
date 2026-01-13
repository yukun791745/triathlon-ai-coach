/**
 * 定数定義
 */

// HaiMirai ブランドカラー
export const BRAND_COLORS = {
  // ネイビー系
  navy: {
    dark: '#1a1f4d',
    base: '#2d3561',
    light: '#4a5078',
  },
  // ブルー系
  blue: {
    dark: '#3b82f6',
    base: '#6666FF',
    light: '#93c5fd',
  },
  // ライトブルー系
  lightBlue: {
    dark: '#0ea5e9',
    base: '#38bdf8',
    light: '#7dd3fc',
  },
  // ピンク系
  pink: {
    dark: '#ec4899',
    base: '#FF33CC',
    light: '#f9a8d4',
  },
  // ライトピンク系
  lightPink: {
    dark: '#f472b6',
    base: '#fda4c8',
    light: '#fce7f3',
  },
  // ホワイト系
  white: {
    base: '#ffffff',
    soft: '#fafafa',
    muted: '#f5f5f5',
  },
} as const;

// アプリケーション設定
export const APP_CONFIG = {
  name: 'HaiMirai Triathlon AI Coach',
  version: '1.0.0',
  description: 'トライアスロントレーニングのためのAIコーチングアプリ',
} as const;

// トレーニングゾーン設定
export const TRAINING_ZONES = {
  zone1: { name: 'アクティブリカバリー', minPercent: 0, maxPercent: 55 },
  zone2: { name: '持久力', minPercent: 56, maxPercent: 75 },
  zone3: { name: 'テンポ', minPercent: 76, maxPercent: 90 },
  zone4: { name: '閾値', minPercent: 91, maxPercent: 105 },
  zone5: { name: 'VO2Max', minPercent: 106, maxPercent: 150 },
} as const;

// TSB（Training Stress Balance）の目安
export const TSB_GUIDELINES = {
  optimal: { min: 15, max: 25, label: 'レース最適' },
  fresh: { min: 10, max: 14, label: 'フレッシュ' },
  neutral: { min: -10, max: 9, label: '中立' },
  tired: { min: -20, max: -11, label: '疲労' },
  overreached: { min: -30, max: -21, label: '過負荷' },
  danger: { max: -31, label: '要注意' },
} as const;

// ローカルストレージキー
export const STORAGE_KEYS = {
  stravaTokens: 'haimirai_strava_tokens',
  userSettings: 'haimirai_user_settings',
  trainingZones: 'haimirai_training_zones',
  cachedActivities: 'haimirai_cached_activities',
  cachedMetrics: 'haimirai_cached_metrics',
} as const;

// API タイムアウト設定
export const API_CONFIG = {
  timeout: 30000, // 30秒
  retryAttempts: 3,
  retryDelay: 1000, // 1秒
} as const;
