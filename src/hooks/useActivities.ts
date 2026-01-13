import React from 'react';

export function useActivities(opts?: { useMock?: boolean }) {
  // 最小スタブ: 実際の実装に置き換えてください
  const [activities] = React.useState<any[]>([]);
  const loading = false;
  return { activities, loading };
}
