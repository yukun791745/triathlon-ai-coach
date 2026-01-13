import React from 'react';
import { Activity as ActivityIcon, Clock, TrendingUp } from 'lucide-react';
import type { Activity } from '../../types/activity';
import { formatDuration } from '../../../lib/utils';

interface RecentActivityCardProps {
  activities: Activity[];
  onViewAll: () => void;
}

const sportIcons: Record<string, string> = {
  run: '🏃',
  ride: '🚴',
  swim: '🏊',
};

export function RecentActivityCard({ activities, onViewAll }: RecentActivityCardProps) {
  const recentActivities = activities.slice(0, 3);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[#2d3561]">最近のアクティビティ</h2>
        <button 
          onClick={onViewAll}
          className="text-xs text-[#6666FF] hover:text-[#5555EE] font-medium"
        >
          すべて見る
        </button>
      </div>

      <div className="space-y-2">
        {recentActivities.map((activity) => (
          <div 
            key={activity.id} 
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-2xl">{sportIcons[activity.type] || '🏃'}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {activity.name}
              </h3>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(activity.moving_time)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ActivityIcon className="w-3 h-3" />
                  <span>{(activity.distance / 1000).toFixed(1)} km</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#6666FF]">
                {activity.suffer_score || activity.tss || 0}
              </div>
              <div className="text-[10px] text-gray-400">TSS</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
