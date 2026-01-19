/**
 * トレーニング指標の型定義
 * 既存の METRICS_DATA に基づく
 */

export interface MetricInfo {
  name: string;
  equivalent: string;
  shortDesc: string;
  icon: string;
  color: string;
}

export interface MetricsData {
  trainingLoad: MetricInfo;
  normalizedPower: MetricInfo;
  intensityFactor: MetricInfo;
  fitness: MetricInfo;
  fatigue: MetricInfo;
  condition: MetricInfo;
  ftp: MetricInfo;
  css: MetricInfo;
  thresholdPace: MetricInfo;
  weeklyLoad: MetricInfo;
}

export interface FitnessMetrics {
  ctl: number;
  ctlDelta: number;
  atl: number;
  atlDelta: number;
  tsb: number;
  tsbDelta: number;
  date?: string;
}

export interface TrainingZones {
  ftp?: number;
  css?: number;
  thresholdPace?: string;
  zones?: {
    zone1: { min: number; max: number };
    zone2: { min: number; max: number };
    zone3: { min: number; max: number };
    zone4: { min: number; max: number };
    zone5: { min: number; max: number };
  };
}

export interface TSSCalculation {
  tss: number;
  normalizedPower?: number;
  intensityFactor?: number;
  duration: number;
}
