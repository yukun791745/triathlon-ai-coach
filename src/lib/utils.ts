/**
 * ユーティリティ関数
 */

/**
 * 距離をフォーマット（メートル → キロメートル）
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 時間をフォーマット（秒 → h:mm:ss または mm:ss）
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * ペースをフォーマット（m/s → min/km または min/100m）
 */
export function formatPace(speedMs: number, unit: 'km' | '100m' = 'km'): string {
  if (unit === 'km') {
    const paceMinPerKm = 1000 / (speedMs * 60);
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    const paceMinPer100m = 100 / (speedMs * 60);
    const minutes = Math.floor(paceMinPer100m);
    const seconds = Math.round((paceMinPer100m - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * 日付をフォーマット
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  
  return `${year}年${month}月${day}日（${weekday}）`;
}

/**
 * 日付と時刻をフォーマット
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDate(d);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * 残り日数を計算
 */
export function calculateDaysLeft(targetDate: string | Date): number {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * コンディションステータスを取得
 */
export function getConditionStatus(tsb: number): {
  status: string;
  color: string;
  bg: string;
  border: string;
} {
  if (tsb > 15) {
    return {
      status: '良好',
      color: 'text-[#FF33CC]',
      bg: 'bg-[#FF33CC]/5',
      border: 'border-[#FF33CC]/20'
    };
  }
  if (tsb < 5) {
    return {
      status: '注意',
      color: 'text-[#FF33CC]',
      bg: 'bg-[#FF33CC]/5',
      border: 'border-[#FF33CC]/20'
    };
  }
  return {
    status: '適正',
    color: 'text-[#6666FF]',
    bg: 'bg-[#6666FF]/5',
    border: 'border-[#6666FF]/20'
  };
}

/**
 * アクティビティタイプの日本語名を取得
 */
export function getActivityTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'Swim': 'スイム',
    'Bike': 'バイク',
    'Run': 'ラン',
    'Triathlon': 'トライアスロン',
    'Other': 'その他',
  };
  return typeMap[type] || type;
}

/**
 * アクティビティタイプの色を取得
 */
export function getActivityTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    'Swim': 'bg-indigo-300/80 text-indigo-700',
    'Bike': 'bg-rose-300/80 text-rose-700',
    'Run': 'bg-purple-300/80 text-purple-700',
    'Triathlon': 'bg-pink-300/80 text-pink-700',
    'Other': 'bg-slate-300/80 text-slate-700',
  };
  return colorMap[type] || colorMap['Other'];
}
