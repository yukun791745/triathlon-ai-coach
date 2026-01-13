/**
 * レースの型定義
 */

export type RaceDistance = 'Sprint' | 'Olympic' | 'Half' | 'Full' | 'Other';

export interface Race {
  id: number;
  name: string;
  date: string;
  dateFormatted: string;
  daysLeft: number;
  distance: RaceDistance;
  location?: string;
  targetTime?: string;
  predictedTime?: string;
  registrationUrl?: string;
  notes?: string;
}

export interface RacePlan {
  raceId: number;
  swimPlan?: {
    targetPace: string;
    strategy: string;
  };
  bikePlan?: {
    targetPower: number;
    targetSpeed: number;
    strategy: string;
  };
  runPlan?: {
    targetPace: string;
    strategy: string;
  };
  nutrition?: {
    preRace: string;
    duringRace: string;
  };
}
