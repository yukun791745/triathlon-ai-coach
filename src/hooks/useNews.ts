import React from 'react';

export function useNews(opts?: { useMock?: boolean }) {
  const [news] = React.useState<any[]>([]);
  const loading = false;
  return { news, loading };
}
