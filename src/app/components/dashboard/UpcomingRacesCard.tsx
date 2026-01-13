import React from 'react';
import { Trophy, Calendar, MapPin } from 'lucide-react';
import type { Race } from '../../types/race';
import { formatDate } from '../../../lib/utils';

interface UpcomingRacesCardProps {
  races: Race[];
  onViewAll: () => void;
}

export function UpcomingRacesCard({ races, onViewAll }: UpcomingRacesCardProps) {
  const upcomingRaces = races.slice(0, 2);

  if (upcomingRaces.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#2d3561]">予定されたレース</h2>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          レースの予定はありません
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[#2d3561]">予定されたレース</h2>
        <button 
          onClick={onViewAll}
          className="text-xs text-[#6666FF] hover:text-[#5555EE] font-medium"
        >
          すべて見る
        </button>
      </div>

      <div className="space-y-3">
        {upcomingRaces.map((race) => (
          <div 
            key={race.id} 
            className="border border-pink-100 rounded-lg p-3 bg-gradient-to-br from-pink-50/50 to-purple-50/30"
          >
            <div className="flex items-start gap-2 mb-2">
              <Trophy className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
              <h3 className="text-sm font-bold text-gray-900 flex-1">{race.name}</h3>
            </div>
            <div className="space-y-1 ml-6">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(race.date)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <MapPin className="w-3 h-3" />
                <span>{race.location}</span>
              </div>
            </div>
            {race.distance && (
              <div className="mt-2 pt-2 border-t border-pink-100">
                <span className="text-xs text-gray-500">距離: </span>
                <span className="text-xs font-semibold text-pink-600">{race.distance}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
