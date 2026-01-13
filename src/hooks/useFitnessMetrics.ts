import React from 'react';

export function useFitnessMetrics(opts?: { useMock?: boolean }) {
  // 最小スタブのメトリクス（ctl/atl/tsb を持つ）
  const [metrics] = React.useState<{ ctl: number; atl: number; tsb: number } | null>({
    ctl: 50,
    atl: 40,
    tsb: 10,
  });
  const loading = false;
  return { metrics, loading };
}
