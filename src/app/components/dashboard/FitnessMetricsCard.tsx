import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { FitnessMetrics } from '../../types/metrics';

interface FitnessMetricsCardProps {
  metrics: FitnessMetrics;
}

export function FitnessMetricsCard({ metrics }: FitnessMetricsCardProps) {
  const { ctl, atl, tsb, trainingLoad } = metrics;

  const getTSBStatus = (value: number) => {
    if (value > 10) return { label: '回復期', color: 'text-green-600', bg: 'bg-green-50' };
    if (value > -10) return { label: '最適', color: 'text-blue-600', bg: 'bg-blue-50' };
    return { label: '疲労', color: 'text-orange-600', bg: 'bg-orange-50' };
  };

  const tsbStatus = getTSBStatus(tsb);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-[#2d3561]">体調メトリクス</h2>
        <Activity className="w-5 h-5 text-[#6666FF]" />
      </div>

      {/* TSB Status */}
      <div className={`${tsbStatus.bg} rounded-lg p-3 mb-4`}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">トレーニング状態</span>
          <span className={`text-sm font-bold ${tsbStatus.color}`}>{tsbStatus.label}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${tsbStatus.color}`}>{tsb.toFixed(0)}</span>
          <span className="text-xs text-gray-500">TSB</span>
        </div>
      </div>

      {/* CTL & ATL */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-gray-600">フィットネス</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-blue-600">{ctl.toFixed(0)}</span>
            <span className="text-xs text-gray-500">CTL</span>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-xs text-gray-600">疲労</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-orange-600">{atl.toFixed(0)}</span>
            <span className="text-xs text-gray-500">ATL</span>
          </div>
        </div>
      </div>

      {/* Training Load */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">今週のトレーニング負荷</span>
          <span className="font-semibold text-[#6666FF]">{trainingLoad.toFixed(0)} TSS</span>
        </div>
      </div>
    </div>
  );
}
