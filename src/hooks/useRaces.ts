import React from 'react';

export function useRaces(opts?: { useMock?: boolean }) {
  const [races] = React.useState<any[]>([]);
  const loading = false;
  return { races, loading };
}
